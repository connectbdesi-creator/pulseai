'use client'

import { useMemo, useState } from 'react'
import { cn } from '@/lib/cn'
import { ArticleCard } from '@/components/ui/ArticleCard'
import type { ArticleImportance } from '@/types/database'

export type FeedArticle = {
  id: string
  slug: string
  title: string
  summary: string | null
  importance: ArticleImportance
  published_at: string | null
  source_name: string | null
  category: string | null
  model_names: string[]
}

const FILTERS: { label: string; value: string | null }[] = [
  { label: 'All', value: null },
  { label: 'LLMs', value: 'llm' },
  { label: 'Image', value: 'image' },
  { label: 'Code', value: 'code' },
  { label: 'Audio', value: 'audio' },
  { label: 'Multimodal', value: 'multimodal' },
]

const PAGE_SIZE = 12

export function ArticlesFeed({ articles }: { articles: FeedArticle[] }) {
  const [filter, setFilter] = useState<string | null>(null)
  const [visible, setVisible] = useState(PAGE_SIZE)

  const filtered = useMemo(() => {
    if (!filter) return articles
    return articles.filter(
      (a) => a.category && a.category.toLowerCase() === filter
    )
  }, [articles, filter])

  const shown = filtered.slice(0, visible)
  const canLoadMore = visible < filtered.length

  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="flex items-end justify-between gap-4">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Latest updates
        </h2>
      </div>

      <div
        className="mt-6 flex flex-wrap gap-2"
        role="tablist"
        aria-label="Filter articles by category"
      >
        {FILTERS.map((f) => {
          const active = filter === f.value
          return (
            <button
              key={f.label}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                setFilter(f.value)
                setVisible(PAGE_SIZE)
              }}
              className={cn(
                'inline-flex h-8 items-center rounded-full border px-3.5 text-sm font-medium transition-colors',
                active
                  ? 'border-brand-600 bg-brand-600 text-white'
                  : 'border-border bg-surface text-foreground/80 hover:border-brand-500/40 hover:text-foreground'
              )}
            >
              {f.label}
            </button>
          )
        })}
      </div>

      {shown.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-border bg-surface-muted p-10 text-center text-sm text-muted">
          No updates in this category yet.
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((a) => (
            <ArticleCard
              key={a.id}
              slug={a.slug}
              title={a.title}
              summary={a.summary}
              importance={a.importance}
              publishedAt={a.published_at}
              sourceName={a.source_name}
              modelNames={a.model_names}
            />
          ))}
        </div>
      )}

      {canLoadMore && (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={() => setVisible((v) => v + PAGE_SIZE)}
            className="inline-flex h-10 items-center rounded-md border border-border bg-surface px-5 text-sm font-medium hover:border-brand-500/40 hover:text-brand-600"
          >
            Load more
          </button>
        </div>
      )}
    </section>
  )
}
