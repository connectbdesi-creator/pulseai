import Groq from 'groq-sdk'
import type { RelevanceResult, ScrapedItem } from './types'

const VALID_CATEGORIES = new Set([
  '',
  'llm',
  'image',
  'code',
  'audio',
  'multimodal',
  'infrastructure',
])

const SYSTEM_PROMPT = `You classify whether a news article is about a specific AI model update, new model release, pricing change, or new capability. Respond with JSON only.

Output schema:
- relevant: true only if the article is primarily about one of the above. General AI commentary, opinion pieces, and tutorials are NOT relevant.
- models: array of model names explicitly mentioned (e.g., "GPT-4o", "Claude Opus 4", "Gemini 2.5 Pro"). Empty array if none.
- category: one of "llm", "image", "code", "audio", "multimodal", "infrastructure". Empty string if unclear.

Return JSON of shape: {"relevant": boolean, "models": string[], "category": string}`

function truncate(input: string, max = 1500): string {
  if (input.length <= max) return input
  return input.slice(0, max) + '…'
}

// Lazy-init: if we construct at module top, it fires before index.ts has had
// a chance to call process.loadEnvFile('.env.local').
let _groq: Groq | null = null
function getGroq(): Groq {
  if (!_groq) _groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
  return _groq
}

export async function classifyRelevance(
  item: Pick<ScrapedItem, 'title' | 'content'>
): Promise<RelevanceResult> {
  if (!process.env.GROQ_API_KEY) {
    console.error('[filter] GROQ_API_KEY missing — treating as not relevant')
    return { relevant: false, models: [], category: '' }
  }

  const userText = `Title: ${item.title}\n\nContent: ${truncate(item.content || '(no body)')}`

  try {
    const completion = await getGroq().chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userText },
      ],
      temperature: 0,
      max_tokens: 256,
      response_format: { type: 'json_object' },
    })

    const text = completion.choices[0]?.message?.content ?? ''
    if (!text) return { relevant: false, models: [], category: '' }

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