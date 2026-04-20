import { fetchWithTimeout } from '../supabase'
import type { ScrapedItem } from '../types'

const SUBREDDITS = ['MachineLearning', 'LocalLLaMA']
const MIN_SCORE = 20

// Reddit blocks the default Node user-agent. Use a descriptive one per their
// API rules.
const USER_AGENT = 'web:pulseai-scraper:0.1 (+https://pulseai.app)'

type RedditChild = {
  data: {
    title?: string
    url?: string
    permalink?: string
    selftext?: string
    score?: number
    created_utc?: number
    stickied?: boolean
    over_18?: boolean
  }
}

async function fetchOne(subreddit: string): Promise<ScrapedItem[]> {
  const url = `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/new.json?limit=25`
  try {
    const res = await fetchWithTimeout(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
      },
    })
    if (!res.ok) {
      console.error(`[reddit] r/${subreddit} HTTP ${res.status}`)
      return []
    }
    const body = (await res.json()) as {
      data?: { children?: RedditChild[] }
    }
    const children = body.data?.children ?? []
    const items: ScrapedItem[] = []
    for (const { data } of children) {
      if (data.stickied || data.over_18) continue
      const score = data.score ?? 0
      if (score <= MIN_SCORE) continue
      const title = (data.title ?? '').trim()
      if (!title) continue
      // Prefer the submitted URL; for self-posts, fall back to the reddit
      // permalink so we always have a unique URL to hash.
      const rawUrl = data.url?.trim() || ''
      const permalinkUrl = data.permalink
        ? `https://www.reddit.com${data.permalink}`
        : ''
      const finalUrl = rawUrl || permalinkUrl
      if (!finalUrl) continue
      items.push({
        title,
        url: finalUrl,
        content: (data.selftext ?? '').replace(/\s+/g, ' ').trim(),
        publishedAt: data.created_utc
          ? new Date(data.created_utc * 1000).toISOString()
          : null,
        sourceName: `r/${subreddit}`,
      })
    }
    return items
  } catch (err) {
    console.error(
      `[reddit] r/${subreddit} failed`,
      err instanceof Error ? err.message : err
    )
    return []
  }
}

export async function fetchRedditItems(): Promise<ScrapedItem[]> {
  const results = await Promise.all(SUBREDDITS.map(fetchOne))
  return results.flat()
}
