import { GoogleGenerativeAI } from '@google/generative-ai'
import { createScraperClient } from '../scraper/supabase'
import type { ScrapedItem } from '../scraper/types'

// --- Contract ---------------------------------------------------------
// Everything below uses only this shape — the Gemini call is isolated so
// swapping to Claude later means changing the init + generate call only.
export type ArticleDraft = {
  title: string
  slug: string
  summary: string
  body: string
  importance: 'breaking' | 'major' | 'minor'
  model_ids: string[]
  category: string | null
  source_url: string
  source_name: string
  published_at: string | null
  ai_generated: true
}

type WriterOutput = {
  title: string
  slug: string
  summary: string
  body: string
  importance: ArticleDraft['importance']
  tags: string[]
}

const VALID_IMPORTANCE = new Set<ArticleDraft['importance']>([
  'breaking',
  'major',
  'minor',
])

const RATE_LIMIT_DELAY_MS = 4_000

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function truncate(s: string, max = 2000) {
  return s.length <= max ? s : `${s.slice(0, max)}…`
}

function toSlugFallback(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

function buildPrompt(
  item: ScrapedItem,
  relevantModels: string[],
  category: string
): string {
  return `You are a technical journalist for PulseAI, a platform that tracks AI model updates for developers. Write factual, clear, developer-focused news summaries. No hype. Cite your sources. Output only valid JSON with no markdown formatting or backticks.

Write a news article about this AI update.

Source: ${item.sourceName}
URL: ${item.url}
Content: ${truncate(item.content || '(no body available)')}
Relevant models: ${relevantModels.join(', ') || '(none detected)'}
Category: ${category || '(unknown)'}

Output JSON with exactly these fields:
{
  "title": string (max 12 words, factual),
  "slug": string (url-safe, kebab-case, include model name and date like YYYY-MM-DD),
  "summary": string (max 25 words, what changed),
  "body": string (markdown, 300-450 words, structured with ## headings: ## What Changed, ## Why It Matters, ## Key Details),
  "importance": "breaking" | "major" | "minor",
  "tags": string[] (the AI model names this article is about, e.g. ["GPT-4o"])
}`
}

// --- Gemini call ------------------------------------------------------
// When swapping to Claude later, only these two exports change — the callers
// in run.ts stay the same.
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '')
const model = genAI.getGenerativeModel({
  model: 'gemini-2.0-flash',
  generationConfig: {
    responseMimeType: 'application/json',
    temperature: 0.3,
  },
})

async function generateWriterJson(prompt: string): Promise<WriterOutput> {
  const result = await model.generateContent(prompt)
  const text = result.response.text()
  // Defence in depth: strip any markdown fences even though responseMimeType
  // is set. Occasional Gemini responses still sneak them in.
  const cleaned = text.replace(/```(?:json)?/g, '').trim()
  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch (err) {
    throw new Error(
      `Writer returned non-JSON response: ${cleaned.slice(0, 200)}… (${err instanceof Error ? err.message : err})`
    )
  }
  const out = parsed as Partial<WriterOutput>
  if (
    typeof out.title !== 'string' ||
    typeof out.slug !== 'string' ||
    typeof out.summary !== 'string' ||
    typeof out.body !== 'string' ||
    typeof out.importance !== 'string' ||
    !VALID_IMPORTANCE.has(out.importance as ArticleDraft['importance']) ||
    !Array.isArray(out.tags)
  ) {
    throw new Error(
      `Writer JSON missing required fields: ${JSON.stringify(parsed).slice(0, 200)}`
    )
  }
  return {
    title: out.title.trim(),
    slug: out.slug.trim(),
    summary: out.summary.trim(),
    body: out.body.trim(),
    importance: out.importance as ArticleDraft['importance'],
    tags: out.tags.filter((t): t is string => typeof t === 'string'),
  }
}

// --- Model name → id lookup ------------------------------------------
async function resolveModelIds(names: string[]): Promise<string[]> {
  if (names.length === 0) return []
  const supabase = createScraperClient()
  const { data, error } = await supabase.from('models').select('id, name, slug')
  if (error) {
    console.error('[writer] model lookup failed:', error.message)
    return []
  }

  const byKey = new Map<string, string>()
  for (const m of (data ?? []) as { id: string; name: string; slug: string }[]) {
    byKey.set(m.name.toLowerCase().trim(), m.id)
    byKey.set(m.slug.toLowerCase().trim(), m.id)
  }

  const matched = new Set<string>()
  for (const name of names) {
    const key = name.toLowerCase().trim()
    const id = byKey.get(key)
    if (id) matched.add(id)
  }
  return Array.from(matched)
}

// --- Public API -------------------------------------------------------
export async function writeArticle(
  scrapedItem: ScrapedItem,
  relevantModels: string[],
  category: string
): Promise<ArticleDraft> {
  const prompt = buildPrompt(scrapedItem, relevantModels, category)
  const writerOut = await generateWriterJson(prompt)

  // Honour free-tier rate limit (15 req/min ⇒ 4s between calls).
  await sleep(RATE_LIMIT_DELAY_MS)

  // Match against tags first, then fall back to the classifier's list so we
  // still link the article to a model even if the writer's tags were off.
  const nameUnion = Array.from(
    new Set([...writerOut.tags, ...relevantModels].map((n) => n.trim()).filter(Boolean))
  )
  const modelIds = await resolveModelIds(nameUnion)

  const slug = writerOut.slug || toSlugFallback(writerOut.title)

  return {
    title: writerOut.title,
    slug,
    summary: writerOut.summary,
    body: writerOut.body,
    importance: writerOut.importance,
    model_ids: modelIds,
    category: category || null,
    source_url: scrapedItem.url,
    source_name: scrapedItem.sourceName,
    published_at: scrapedItem.publishedAt ?? new Date().toISOString(),
    ai_generated: true,
  }
}
