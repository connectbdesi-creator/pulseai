import Parser from 'rss-parser'
import type { ScrapedItem } from '../types'

type FeedSpec = { url: string; sourceName: string }

const FEEDS: FeedSpec[] = [
  { url: 'https://openai.com/news/rss.xml', sourceName: 'OpenAI' },
  { url: 'https://www.anthropic.com/news/rss.xml', sourceName: 'Anthropic' },
  { url: 'https://blog.google/technology/ai/rss/', sourceName: 'Google AI Blog' },
  { url: 'https://huggingface.co/blog/feed.xml', sourceName: 'Hugging Face' },
]

// Keep the first run sane. OpenAI / HF feeds return hundreds of archive
// items — without these caps a single run would hammer Groq for 30+ min.
const MAX_ITEMS_PER_FEED = 50
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000 // 14 days

// rss-parser sets its own timeout (in ms). Keep it tight so a single dead feed
// doesn't drag the whole run.
const parser = new Parser({ timeout: 15_000 })

function stripHtml(input: string): string {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function toIso(raw: string | undefined): string | null {
  if (!raw) return null
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function isRecent(iso: string | null): boolean {
  // Require a parseable publish date. Items without a date are dropped —
  // better to miss a rare undated item than re-process an entire archive.
  if (!iso) return false
  return Date.now() - new Date(iso).getTime() <= MAX_AGE_MS
}

async function fetchOne(spec: FeedSpec): Promise<ScrapedItem[]> {
  try {
    const feed = await parser.parseURL(spec.url)
    const out: ScrapedItem[] = []
    for (const item of feed.items ?? []) {
      const title = (item.title ?? '').trim()
      const url = (item.link ?? '').trim()
      if (!title || !url) continue
      const publishedAt = toIso(item.isoDate ?? item.pubDate)
      if (!isRecent(publishedAt)) continue
      const rawContent =
        item.contentSnippet ?? item.content ?? item.summary ?? ''
      out.push({
        title,
        url,
        content: stripHtml(String(rawContent)),
        publishedAt,
        sourceName: spec.sourceName,
      })
    }
    // Feeds are newest-first, but belt + braces: sort by date desc before
    // capping so we always keep the most recent items.
    out.sort((a, b) => {
      const ta = a.publishedAt ? Date.parse(a.publishedAt) : 0
      const tb = b.publishedAt ? Date.parse(b.publishedAt) : 0
      return tb - ta
    })
    return out.slice(0, MAX_ITEMS_PER_FEED)
  } catch (err) {
    console.error(`[rss] failed: ${spec.url}`, err instanceof Error ? err.message : err)
    return []
  }
}

export async function fetchRssItems(): Promise<ScrapedItem[]> {
  const results = await Promise.all(FEEDS.map(fetchOne))
  return results.flat()
}
