import { fetchWithTimeout } from './supabase'
import type { RelevanceResult, ScrapedItem } from './types'

const GEMINI_MODEL = 'gemini-2.5-flash'
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

const VALID_CATEGORIES = new Set([
  '',
  'llm',
  'image',
  'code',
  'audio',
  'multimodal',
  'infrastructure',
])

const SYSTEM_PROMPT = `You classify whether a news article is about a specific AI model update, new model release, pricing change, or new capability.

Output schema:
- relevant: true only if the article is primarily about one of the above. General AI commentary, opinion pieces, and tutorials are NOT relevant.
- models: array of model names explicitly mentioned (e.g., "GPT-4o", "Claude Opus 4", "Gemini 2.5 Pro"). Empty array if none.
- category: one of "llm", "image", "code", "audio", "multimodal", "infrastructure". Empty string if unclear.`

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    relevant: { type: 'BOOLEAN' },
    models: { type: 'ARRAY', items: { type: 'STRING' } },
    category: { type: 'STRING' },
  },
  required: ['relevant', 'models', 'category'],
} as const

function truncate(input: string, max = 1500): string {
  if (input.length <= max) return input
  return input.slice(0, max) + '…'
}

export async function classifyRelevance(
  item: Pick<ScrapedItem, 'title' | 'content'>
): Promise<RelevanceResult> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    console.error('[filter] GEMINI_API_KEY missing — treating as not relevant')
    return { relevant: false, models: [], category: '' }
  }

  const userText =
    `Title: ${item.title}\n\nContent: ${truncate(item.content || '(no body)')}`

  try {
    const res = await fetchWithTimeout(
      `${GEMINI_ENDPOINT}?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: 'user', parts: [{ text: userText }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: RESPONSE_SCHEMA,
            temperature: 0,
          },
        }),
      },
      20_000
    )

    if (!res.ok) {
      const body = await res.text()
      console.error(`[filter] Gemini HTTP ${res.status}`, body.slice(0, 300))
      return { relevant: false, models: [], category: '' }
    }

    const body = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> }
      }>
    }
    const text = body.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) {
      return { relevant: false, models: [], category: '' }
    }

    const parsed = JSON.parse(text) as Partial<RelevanceResult>
    const category = (parsed.category ?? '').toLowerCase()
    return {
      relevant: Boolean(parsed.relevant),
      models: Array.isArray(parsed.models)
        ? parsed.models.filter((m): m is string => typeof m === 'string')
        : [],
      category: VALID_CATEGORIES.has(category) ? category : '',
    }
  } catch (err) {
    console.error('[filter] failed', err instanceof Error ? err.message : err)
    return { relevant: false, models: [], category: '' }
  }
}
