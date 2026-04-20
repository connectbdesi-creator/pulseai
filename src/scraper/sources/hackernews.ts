import { fetchWithTimeout } from '../supabase'
import type { ScrapedItem } from '../types'

// HN Algolia search. Restricts to stories ≥50 points published in the last 24h.
export async function fetchHackerNewsItems(): Promise<ScrapedItem[]> {
  const since = Math.floor(Date.now() / 1000) - 60 * 60 * 24
  const url =
    'https://hn.algolia.com/api/v1/search' +
    `?query=${encodeURIComponent('AI model')}` +
    '&tags=story' +
    `&numericFilters=${encodeURIComponent(`points>50,created_at_i>${since}`)}` +
    '&hitsPerPage=50'

  try {
    const res = await fetchWithTimeout(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) {
      console.error(`[hn] HTTP ${res.status}`)
      return []
    }
    const body = (await res.json()) as {
      hits?: Array<{
        title?: string
        url?: string
        story_text?: string | null
        created_at?: string
        objectID?: string
      }>
    }
    const hits = body.hits ?? []
    const items: ScrapedItem[] = []
    for (const h of hits) {
      const title = (h.title ?? '').trim()
      if (!title) continue
      const url =
        (h.url && h.url.trim()) ||
        (h.objectID ? `https://news.ycombinator.com/item?id=${h.objectID}` : '')
      if (!url) continue
      items.push({
        title,
        url,
        content: (h.story_text ?? '').replace(/\s+/g, ' ').trim(),
        publishedAt: h.created_at ?? null,
        sourceName: 'Hacker News',
      })
    }
    return items
  } catch (err) {
    console.error('[hn] failed', err instanceof Error ? err.message : err)
    return []
  }
}
