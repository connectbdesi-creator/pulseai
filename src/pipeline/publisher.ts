import { randomBytes } from 'node:crypto'
import { createScraperClient } from '../scraper/supabase'
import type { ArticleDraft } from './writer'

export type PublishedArticle = ArticleDraft & {
  id: string
  is_published: boolean
  created_at: string
}

const SLUG_RETRY_LIMIT = 3

async function triggerNotify(articleId: string): Promise<void> {
  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  ).replace(/\/$/, '')
  const secret = process.env.NOTIFY_SECRET
  if (!secret) {
    console.warn('[publisher] NOTIFY_SECRET unset — skipping notify')
    return
  }
  try {
    const res = await fetch(`${siteUrl}/api/notify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-notify-secret': secret,
      },
      body: JSON.stringify({ articleId }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error(
        `[publisher] notify HTTP ${res.status} ${body.slice(0, 200)}`
      )
    } else {
      const summary = await res.json().catch(() => null)
      console.log(`[publisher] notified`, summary)
    }
  } catch (err) {
    console.error(
      '[publisher] notify failed',
      err instanceof Error ? err.message : err
    )
  }
}

// Inserts the draft into `articles` with is_published = true.
// If the slug collides with an existing row, retry with a 4-char hex suffix.
export async function publishArticle(
  article: ArticleDraft
): Promise<PublishedArticle> {
  const supabase = createScraperClient()
  let slug = article.slug
  let attempt = 0

  while (attempt < SLUG_RETRY_LIMIT) {
    const { data, error } = await supabase
      .from('articles')
      .insert({
        title: article.title,
        slug,
        summary: article.summary,
        body: article.body,
        model_ids: article.model_ids,
        model_tags: article.model_tags,
        category: article.category,
        importance: article.importance,
        source_url: article.source_url,
        source_name: article.source_name,
        published_at: article.published_at,
        ai_generated: article.ai_generated,
        is_published: true,
      })
      .select('*')
      .single()

    if (!error && data) {
      const published = data as PublishedArticle
      // Fire-and-log notify for breaking/major; never throws up the stack.
      if (
        published.importance === 'breaking' ||
        published.importance === 'major'
      ) {
        await triggerNotify(published.id)
      }
      return published
    }

    const isUniqueSlug =
      error?.code === '23505' &&
      (error.message ?? '').toLowerCase().includes('slug')
    if (!isUniqueSlug) {
      throw error ?? new Error('Insert failed without an error payload')
    }

    // Collision — append a short random suffix and try again.
    const suffix = randomBytes(2).toString('hex')
    slug = `${article.slug}-${suffix}`
    attempt += 1
  }

  throw new Error(
    `Slug collision retry limit exceeded for "${article.slug}"`
  )
}
