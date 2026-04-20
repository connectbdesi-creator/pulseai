import Parser from 'rss-parser'
import type { ScrapedItem } from '../types'

type FeedSpec = { url: string; sourceName: string }

const FEEDS: FeedSpec[] = [
  { url: 'https://openai.com/news/rss.xml', sourceName: 'OpenAI' },
  { url: 'https://www.anthropic.com/rss.xml', sourceName: 'Anthropic' },
  { url: 'https://blog.google/technology/ai/rss/', sourceName: 'Google AI Blog' },
  { url: 'https://mistral.ai/feed.xml', sourceName: 'Mistral AI' },
  { url: 'https://huggingface.co/blog/feed.xml', sourceName: 'Hugging Face' },
]

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

async function fetchOne(spec: FeedSpec): Promise<ScrapedItem[]> {
  try {
    const feed = await parser.parseURL(spec.url)
    const out: ScrapedItem[] = []
    for (const item of feed.items ?? []) {
      const title = (item.title ?? '').trim()
      const url = (item.link ?? '').trim()
      if (!title || !url) continue
      const rawContent =
        item.contentSnippet ?? item.content ?? item.summary ?? ''
      out.push({
        title,
        url,
        content: stripHtml(String(rawContent)),
        publishedAt: toIso(item.isoDate ?? item.pubDate),
        sourceName: spec.sourceName,
      })
    }
    return out
  } catch (err) {
    console.error(`[rss] failed: ${spec.url}`, err instanceof Error ? err.message : err)
    return []
  }
}

export async function fetchRssItems(): Promise<ScrapedItem[]> {
  const results = await Promise.all(FEEDS.map(fetchOne))
  return results.flat()
}
