import type { Metadata } from 'next'
import { createPublicClient } from '@/lib/supabase/public'
import { ModelCard } from '@/components/ui/ModelCard'
import { ModelsFilters } from './ModelsFilters'
import type { ModelCategory, ModelRow } from '@/types/database'

export const metadata: Metadata = {
  title: 'All AI Models',
  description:
    'Browse every AI model PulseAI tracks — LLMs, image, code, audio, multimodal, and infrastructure. Filter, sort, and follow.',
}

const VALID_CATEGORIES: ModelCategory[] = [
  'llm',
  'image',
  'code',
  'audio',
  'multimodal',
  'infrastructure',
]

const SORT_MAP = {
  'most-followed': { column: 'follower_count', ascending: false },
  'recently-updated': { column: 'last_updated_at', ascending: false },
  newest: { column: 'release_date', ascending: false },
} as const

type SearchParams = {
  q?: string
  category?: string
  sort?: string
}

function escapeIlike(raw: string): string {
  return raw.replace(/[%_,]/g, '\\$&')
}

export default async function ModelsIndexPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const sp = await searchParams
  const q = (sp.q ?? '').trim()
  const categoryParam = sp.category ?? ''
  const category =
    VALID_CATEGORIES.includes(categoryParam as ModelCategory)
      ? (categoryParam as ModelCategory)
      : ''
  const sortKey = (sp.sort ?? 'most-followed') as keyof typeof SORT_MAP
  const sort = SORT_MAP[sortKey] ?? SORT_MAP['most-followed']

  const supabase = createPublicClient()
  let query = supabase
    .from('models')
    .select(
      'id, slug, name, maker, category, follower_count, last_updated_at'
    )
    .eq('is_active', true)
    .order(sort.column, {
      ascending: sort.ascending,
      nullsFirst: false,
    })

  if (category) query = query.eq('category', category)
  if (q) query = query.ilike('name', `%${escapeIlike(q)}%`)

  const { data, error } = await query
  if (error) throw error

  const models = (data ?? []) as Pick<
    ModelRow,
    | 'id'
    | 'slug'
    | 'name'
    | 'maker'
    | 'category'
    | 'follower_count'
    | 'last_updated_at'
  >[]

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          All models
        </h1>
        <p className="mt-2 text-sm text-muted">
          Every AI model PulseAI tracks — filter, sort, and follow the ones that
          matter to you.
        </p>
      </header>

      <ModelsFilters
        initialQuery={q}
        initialCategory={category}
        initialSort={sortKey in SORT_MAP ? sortKey : 'most-followed'}
      />

      <div className="mt-4 text-xs text-muted">
        {models.length} {models.length === 1 ? 'model' : 'models'}
      </div>

      {models.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-border bg-surface-muted p-12 text-center text-sm text-muted">
          No models match your filters.
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {models.map((m) => (
            <ModelCard
              key={m.id}
              slug={m.slug}
              name={m.name}
              maker={m.maker}
              category={m.category}
              followerCount={m.follower_count}
              lastUpdatedAt={m.last_updated_at}
            />
          ))}
        </div>
      )}
    </div>
  )
}
