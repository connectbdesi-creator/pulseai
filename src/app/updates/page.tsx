import Link from 'next/link'
import type { Metadata } from 'next'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { createPublicClient } from '@/lib/supabase/public'
import { ArticleCard } from '@/components/ui/ArticleCard'
import { UpdatesFilters } from './UpdatesFilters'
import type {
  ArticleImportance,
  ArticleRow,
  ModelCategory,
} from '@/types/database'

export const metadata: Metadata = {
  title: 'Latest AI Model Updates',
  description:
    'Every notable update, pricing change, and new capability across the AI model landscape — filtered by importance, category, and maker.',
}

const PAGE_SIZE = 10
const VALID_IMPORTANCE: ArticleImportance[] = ['breaking', 'major', 'minor']
const VALID_CATEGORIES: ModelCategory[] = [
  'llm',
  'image',
  'code',
  'audio',
  'multimodal',
  'infrastructure',
]

type SearchParams = {
  importance?: string
  category?: string
  maker?: string
  page?: string
}

function buildQs(
  base: SearchParams,
  overrides: Partial<SearchParams>
): string {
  const next = new URLSearchParams()
  const merged = { ...base, ...overrides }
  for (const [k, v] of Object.entries(merged)) {
    if (v) next.set(k, v)
  }
  const qs = next.toString()
  return qs ? `?${qs}` : ''
}

export default async function UpdatesIndexPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const sp = await searchParams
  const importance = VALID_IMPORTANCE.includes(sp.importance as ArticleImportance)
    ? (sp.importance as ArticleImportance)
    : ''
  const category = VALID_CATEGORIES.includes(sp.category as ModelCategory)
    ? (sp.category as ModelCategory)
    : ''
  const maker = (sp.maker ?? '').trim()
  const page = Math.max(1, Number.parseInt(sp.page ?? '1', 10) || 1)

  const supabase = createPublicClient()

  // Fetch the maker list for the filter dropdown (distinct makers from models).
  const { data: makersRaw } = await supabase
    .from('models')
    .select('maker')
    .eq('is_active', true)
    .not('maker', 'is', null)

  const makers = Array.from(
    new Set(
      (makersRaw ?? [])
        .map((r) => (r.maker ?? '').trim())
        .filter((m): m is string => Boolean(m))
    )
  ).sort((a, b) => a.localeCompare(b))

  // If filtering by maker, resolve to model IDs once.
  let modelIdsForMaker: string[] | null = null
  if (maker) {
    const { data } = await supabase
      .from('models')
      .select('id')
      .eq('maker', maker)
    modelIdsForMaker = (data ?? []).map((m) => m.id as string)
    // Maker with no models ⇒ no articles possible.
    if (modelIdsForMaker.length === 0) modelIdsForMaker = ['__none__']
  }

  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  let query = supabase
    .from('articles')
    .select(
      'id, slug, title, summary, importance, published_at, source_name, category, model_ids, model_tags',
      { count: 'exact' }
    )
    .eq('is_published', true)
    .order('published_at', { ascending: false, nullsFirst: false })
    .range(from, to)

  if (importance) query = query.eq('importance', importance)
  if (category) query = query.eq('category', category)
  if (modelIdsForMaker) query = query.overlaps('model_ids', modelIdsForMaker)

  const { data, error, count } = await query
  if (error) throw error

  const articles = (data ?? []) as Pick<
    ArticleRow,
    | 'id'
    | 'slug'
    | 'title'
    | 'summary'
    | 'importance'
    | 'published_at'
    | 'source_name'
    | 'model_ids'
    | 'model_tags'
  >[]

  const totalCount = count ?? articles.length
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  // Fetch model names once, only for the articles on this page.
  const idSet = new Set<string>()
  for (const a of articles) for (const id of a.model_ids ?? []) idSet.add(id)
  const { data: modelNameRows } = idSet.size
    ? await supabase
        .from('models')
        .select('id, name')
        .in('id', Array.from(idSet))
    : { data: [] as { id: string; name: string }[] }
  const modelNameById = new Map<string, string>(
    (modelNameRows ?? []).map((m) => [m.id as string, m.name as string])
  )

  const baseParams: SearchParams = {
    importance: importance || undefined,
    category: category || undefined,
    maker: maker || undefined,
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Latest AI Model Updates
        </h1>
        <p className="mt-2 text-sm text-muted">
          Every notable update from the AI models PulseAI tracks.
        </p>
      </header>

      <UpdatesFilters
        initialImportance={importance}
        initialCategory={category}
        initialMaker={maker}
        makers={makers}
      />

      <div className="mt-4 text-xs text-muted">
        {totalCount} {totalCount === 1 ? 'update' : 'updates'}
      </div>

      {articles.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-border bg-surface-muted p-12 text-center text-sm text-muted">
          No updates match your filters.
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-4">
          {articles.map((a) => (
            <li key={a.id}>
              <ArticleCard
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
            </li>
          ))}
        </ul>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <nav
          aria-label="Pagination"
          className="mt-10 flex items-center justify-between"
        >
          <PaginationLink
            disabled={page <= 1}
            href={`/updates${buildQs(baseParams, { page: page > 2 ? String(page - 1) : undefined })}`}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </PaginationLink>

          <span className="text-xs text-muted">
            Page {page} of {totalPages}
          </span>

          <PaginationLink
            disabled={page >= totalPages}
            href={`/updates${buildQs(baseParams, { page: String(page + 1) })}`}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </PaginationLink>
        </nav>
      )}
    </div>
  )
}

function PaginationLink({
  href,
  disabled,
  children,
}: {
  href: string
  disabled: boolean
  children: React.ReactNode
}) {
  const cls =
    'inline-flex h-9 items-center gap-1 rounded-md border border-border bg-surface px-4 text-sm font-medium transition-colors hover:border-brand-500/40 hover:text-brand-600'
  if (disabled) {
    return (
      <span
        aria-disabled
        className={`${cls} pointer-events-none opacity-50`}
      >
        {children}
      </span>
    )
  }
  return (
    <Link href={href} className={cls}>
      {children}
    </Link>
  )
}
