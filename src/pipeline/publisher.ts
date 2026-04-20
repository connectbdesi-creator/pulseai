import { randomBytes } from 'node:crypto'
import { createScraperClient } from '../scraper/supabase'
import type { ArticleDraft } from './writer'

export type PublishedArticle = ArticleDraft & {
  id: string
  is_published: boolean
  created_at: string
}

const SLUG_RETRY_LIMIT = 3

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
      return data as PublishedArticle
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
