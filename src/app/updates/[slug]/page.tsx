import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ChevronRight, ExternalLink, Sparkles } from 'lucide-react'
import { createPublicClient } from '@/lib/supabase/public'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/Badge'
import { ArticleCard } from '@/components/ui/ArticleCard'
import { FollowButton } from '@/components/follow/FollowButton'
import { ShareButtons } from './ShareButtons'
import {
  CommentSection,
  type CommentRow,
} from '@/components/comments/CommentSection'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import type { ArticleRow, ModelCategory } from '@/types/database'

const SITE_URL = 'https://pulseai.app'

type PrimaryModel = {
  id: string
  slug: string
  name: string
  maker: string | null
  category: ModelCategory
  follower_count: number
}

function formatDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function estimateReadTime(body: string | null, summary: string | null): number {
  const text = body ?? summary ?? ''
  const words = text.trim().split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / 200))
}

export async function generateStaticParams() {
  const supabase = createPublicClient()
  const { data } = await supabase
    .from('articles')
    .select('slug')
    .eq('is_published', true)
  return (data ?? []).map(({ slug }) => ({ slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const supabase = createPublicClient()

  const { data: article } = await supabase
    .from('articles')
    .select('title, summary, published_at, is_published')
    .eq('slug', slug)
    .maybeSingle()

  if (!article || !article.is_published) {
    return { title: { absolute: 'Update not found — PulseAI' } }
  }

  const description =
    article.summary ??
    `Read the latest update: ${article.title}. Tracked by PulseAI.`

  return {
    title: { absolute: `${article.title} — PulseAI` },
    description,
    alternates: { canonical: `/updates/${slug}` },
    openGraph: {
      title: article.title,
      description,
      type: 'article',
      publishedTime: article.published_at ?? undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: article.title,
      description,
    },
  }
}

export default async function ArticleDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = createPublicClient()

  const { data: article, error } = await supabase
    .from('articles')
    .select('*')
    .eq('slug', slug)
    .eq('is_published', true)
    .maybeSingle<ArticleRow>()

  if (error) throw error
  if (!article) notFound()

  const modelIds = article.model_ids ?? []

  const [modelsRes, modelNamesRes] = await Promise.all([
    modelIds.length > 0
      ? supabase
          .from('models')
          .select('id, slug, name, maker, category, follower_count')
          .in('id', modelIds)
      : Promise.resolve({ data: [], error: null }),
    supabase.from('models').select('id, name'),
  ])

  if (modelsRes.error) throw modelsRes.error
  if (modelNamesRes.error) throw modelNamesRes.error

  const models = (modelsRes.data ?? []) as PrimaryModel[]
  const primary: PrimaryModel | null = models[0] ?? null

  // Auth + follow state for the primary model's CTA.
  const authed = await createClient()
  const {
    data: { user },
  } = await authed.auth.getUser()
  let primaryIsFollowing = false
  if (user && primary) {
    const { count } = await authed
      .from('follows')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('model_id', primary.id)
    primaryIsFollowing = (count ?? 0) > 0
  }

  const modelNameById = new Map<string, string>(
    (modelNamesRes.data ?? []).map((m) => [m.id as string, m.name as string])
  )

  // Related: up to 3 articles sharing a model (preferred) or the same category.
  // Exclude the current article.
  let relatedData: ArticleRow[] = []
  if (modelIds.length > 0) {
    const { data } = await supabase
      .from('articles')
      .select(
        'id, slug, title, summary, importance, published_at, source_name, category, model_ids, model_tags'
      )
      .eq('is_published', true)
      .overlaps('model_ids', modelIds)
      .neq('id', article.id)
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(3)
    relatedData = (data ?? []) as ArticleRow[]
  }
  if (relatedData.length < 3 && article.category) {
    const need = 3 - relatedData.length
    const { data } = await supabase
      .from('articles')
      .select(
        'id, slug, title, summary, importance, published_at, source_name, category, model_ids, model_tags'
      )
      .eq('is_published', true)
      .eq('category', article.category)
      .neq('id', article.id)
      .not('id', 'in', `(${[article.id, ...relatedData.map((r) => r.id)].map((id) => `"${id}"`).join(',')})`)
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(need)
    relatedData = [...relatedData, ...((data ?? []) as ArticleRow[])]
  }

  const readTime = estimateReadTime(article.body, article.summary)
  const publishedLabel = formatDate(article.published_at)
  const canonicalUrl = `${SITE_URL}/updates/${article.slug}`

  // --- Comments ------------------------------------------------------
  // Current user (may be null — viewing signed-out is fine).
  const authedClient = await createClient()
  const {
    data: { user: currentUser },
  } = await authedClient.auth.getUser()

  // Service-role client so we can look up author email handles from public.users
  // even for viewers who don't own those rows (RLS blocks cross-user reads).
  const svcUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  let commentRows: CommentRow[] = []
  if (svcUrl && svcKey) {
    const svc = createServiceClient(svcUrl, svcKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: rawComments } = await svc
      .from('article_comments')
      .select('id, parent_id, body, created_at, user_id')
      .eq('article_id', article.id)
      .eq('is_deleted', false)
      .order('created_at', { ascending: true })
      .limit(500)

    const authorIds = Array.from(
      new Set(
        ((rawComments ?? []) as Array<{ user_id: string }>).map(
          (c) => c.user_id
        )
      )
    )
    const authorMap = new Map<string, { label: string; color: string }>()
    if (authorIds.length > 0) {
      const { data: authors } = await svc
        .from('users')
        .select('id, email')
        .in('id', authorIds)
      for (const a of (authors ?? []) as Array<{ id: string; email: string }>) {
        const handle = (a.email ?? '').split('@')[0] || 'member'
        authorMap.set(a.id, {
          label: handle,
          color: colorForId(a.id),
        })
      }
    }

    commentRows = ((rawComments ?? []) as Array<{
      id: string
      parent_id: string | null
      body: string
      created_at: string
      user_id: string
    }>).map((c) => {
      const meta = authorMap.get(c.user_id) ?? {
        label: 'member',
        color: colorForId(c.user_id),
      }
      return {
        id: c.id,
        parent_id: c.parent_id,
        body: c.body,
        created_at: c.created_at,
        author_id: c.user_id,
        author_label: meta.label,
        author_color: meta.color,
        is_mine: currentUser?.id === c.user_id,
      }
    })
  }

  // Breadcrumb: Home › Updates › [Model name] — skip the last segment when
  // no model is attached (avoids the "Updates › Updates" repetition).
  const breadcrumbTrail: Array<{ label: string; href?: string }> = [
    { label: 'Home', href: '/' },
    { label: 'Updates', href: '/updates' },
  ]
  if (primary) {
    breadcrumbTrail.push({
      label: primary.name,
      href: `/models/${primary.slug}`,
    })
  }

  // JSON-LD: BreadcrumbList + NewsArticle for richer SERP results.
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbTrail.map((b, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: b.label,
      item: b.href ? `${SITE_URL}${b.href}` : undefined,
    })),
  }

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: article.title,
    description: article.summary ?? undefined,
    datePublished: article.published_at ?? undefined,
    url: canonicalUrl,
    mainEntityOfPage: canonicalUrl,
    author: { '@type': 'Organization', name: 'PulseAI' },
    publisher: {
      '@type': 'Organization',
      name: 'PulseAI',
      url: SITE_URL,
    },
    about: primary ? { '@type': 'Thing', name: primary.name } : undefined,
  }

  return (
    <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="text-xs text-muted">
        <ol className="flex flex-wrap items-center gap-1">
          {breadcrumbTrail.map((crumb, i) => {
            const isLast = i === breadcrumbTrail.length - 1
            return (
              <span key={crumb.label} className="flex items-center gap-1">
                {i > 0 && (
                  <li aria-hidden>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </li>
                )}
                <li
                  className={isLast ? 'text-foreground/80' : ''}
                  aria-current={isLast ? 'page' : undefined}
                >
                  {isLast || !crumb.href ? (
                    crumb.label
                  ) : (
                    <Link href={crumb.href} className="hover:text-foreground">
                      {crumb.label}
                    </Link>
                  )}
                </li>
              </span>
            )
          })}
        </ol>
      </nav>

      {/* Header */}
      <header className="mt-6 flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="importance" value={article.importance} />
          {(article.category as ModelCategory | null) &&
          (
            ['llm', 'image', 'code', 'audio', 'multimodal', 'infrastructure'] as ModelCategory[]
          ).includes(article.category as ModelCategory) ? (
            <Badge
              variant="category"
              value={article.category as ModelCategory}
            />
          ) : null}
          {publishedLabel && (
            <span className="text-xs text-muted">{publishedLabel}</span>
          )}
          <span className="text-xs text-muted">· {readTime} min read</span>
        </div>

        <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
          {article.title}
        </h1>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {article.ai_generated && (
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-muted">
                <Sparkles className="h-3 w-3" />
                AI Generated Summary
              </span>
            )}
            {article.source_name && (
              <span className="text-xs text-muted">
                Source:{' '}
                {article.source_url ? (
                  <a
                    href={article.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-foreground/80 hover:text-brand-600"
                  >
                    {article.source_name}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <span className="text-foreground/80">
                    {article.source_name}
                  </span>
                )}
              </span>
            )}
          </div>
          <ShareButtons title={article.title} url={canonicalUrl} />
        </div>
      </header>

      {/* Body */}
      <div className="mt-8 text-[15px] leading-[1.75] text-foreground/85">
        {article.summary && (
          <p className="mb-6 border-l-2 border-brand-600 bg-brand-600/5 px-4 py-3 text-base font-medium text-foreground/80">
            {article.summary}
          </p>
        )}
        {article.body ? (
          <Markdown body={article.body} />
        ) : (
          <p className="text-muted">No body content yet.</p>
        )}
      </div>

      <hr className="my-10 border-border" />

      {/* Follow CTA */}
      {primary && (
        <section className="flex flex-col items-start gap-4 rounded-xl border border-border bg-surface-muted p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              Want updates on {primary.name}?
            </h2>
            <p className="mt-1 text-sm text-muted">
              Follow it to get notified the moment something changes.
            </p>
          </div>
          <FollowButton
            modelId={primary.id}
            modelName={primary.name}
            initialIsFollowing={primaryIsFollowing}
            initialCount={primary.follower_count}
            isAuthenticated={Boolean(user)}
          />
        </section>
      )}

      {/* Related */}
      {relatedData.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xl font-semibold tracking-tight">
            Related updates
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {relatedData.map((a) => (
              <ArticleCard
                key={a.id}
                slug={a.slug}
                title={a.title}
                summary={a.summary}
                importance={a.importance}
                publishedAt={a.published_at}
                sourceName={a.source_name}
                modelNames={
                  a.model_tags && a.model_tags.length > 0
                    ? a.model_tags
                    : (a.model_ids ?? [])
                        .map((id) => modelNameById.get(id))
                        .filter((n): n is string => Boolean(n))
                }
              />
            ))}
          </div>
        </section>
      )}

      {/* Comments */}
      <CommentSection
        articleId={article.id}
        articleSlug={article.slug}
        currentUserId={currentUser?.id ?? null}
        comments={commentRows}
      />
    </article>
  )
}

// Deterministic HSL colour per user id — keeps the comment avatar stable
// across renders without needing a stored value.
function colorForId(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue} 55% 45%)`
}

function Markdown({ body }: { body: string }) {
  return (
    <div className="[&>*+*]:mt-4">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ node: _n, ...props }) => (
            <h2
              className="mt-10 text-2xl font-semibold tracking-tight"
              {...props}
            />
          ),
          h2: ({ node: _n, ...props }) => (
            <h2
              className="mt-10 text-2xl font-semibold tracking-tight"
              {...props}
            />
          ),
          h3: ({ node: _n, ...props }) => (
            <h3
              className="mt-8 text-xl font-semibold tracking-tight"
              {...props}
            />
          ),
          p: ({ node: _n, ...props }) => (
            <p className="leading-[1.75] text-foreground/85" {...props} />
          ),
          a: ({ node: _n, ...props }) => (
            <a
              className="text-brand-600 underline underline-offset-2 hover:text-brand-700"
              target={props.href?.startsWith('http') ? '_blank' : undefined}
              rel={props.href?.startsWith('http') ? 'noreferrer' : undefined}
              {...props}
            />
          ),
          ul: ({ node: _n, ...props }) => (
            <ul className="list-disc space-y-1 pl-6" {...props} />
          ),
          ol: ({ node: _n, ...props }) => (
            <ol className="list-decimal space-y-1 pl-6" {...props} />
          ),
          blockquote: ({ node: _n, ...props }) => (
            <blockquote
              className="border-l-2 border-border pl-4 italic text-foreground/70"
              {...props}
            />
          ),
          code: ({ node: _n, className, children, ...props }) => {
            const isBlock = /language-/.test(className ?? '')
            if (isBlock) {
              return (
                <code
                  className="block overflow-x-auto rounded-md bg-surface-muted p-4 text-sm"
                  {...props}
                >
                  {children}
                </code>
              )
            }
            return (
              <code
                className="rounded bg-surface-muted px-1.5 py-0.5 text-[0.92em]"
                {...props}
              >
                {children}
              </code>
            )
          },
          pre: ({ node: _n, ...props }) => (
            <pre
              className="overflow-x-auto rounded-md bg-surface-muted p-4 text-sm"
              {...props}
            />
          ),
          hr: () => <hr className="my-8 border-border" />,
          table: ({ node: _n, ...props }) => (
            <div className="overflow-x-auto">
              <table
                className="w-full border-collapse text-sm"
                {...props}
              />
            </div>
          ),
          th: ({ node: _n, ...props }) => (
            <th
              className="border border-border bg-surface-muted px-3 py-2 text-left font-semibold"
              {...props}
            />
          ),
          td: ({ node: _n, ...props }) => (
            <td className="border border-border px-3 py-2" {...props} />
          ),
        }}
      >
        {body}
      </ReactMarkdown>
    </div>
  )
}
