'use client'

import { Search } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/cn'
import type { ModelCategory } from '@/types/database'

const CATEGORIES: { value: ModelCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'llm', label: 'LLMs' },
  { value: 'image', label: 'Image' },
  { value: 'code', label: 'Code' },
  { value: 'audio', label: 'Audio' },
  { value: 'multimodal', label: 'Multimodal' },
  { value: 'infrastructure', label: 'Infrastructure' },
]

const SORTS = [
  { value: 'most-followed', label: 'Most Followed' },
  { value: 'recently-updated', label: 'Recently Updated' },
  { value: 'newest', label: 'Newest' },
] as const

export function ModelsFilters({
  initialQuery,
  initialCategory,
  initialSort,
}: {
  initialQuery: string
  initialCategory: string
  initialSort: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [query, setQuery] = useState(initialQuery)

  // Debounced push of the query into the URL
  useEffect(() => {
    const t = setTimeout(() => {
      const next = new URLSearchParams(params.toString())
      if (query) next.set('q', query)
      else next.delete('q')
      const qs = next.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    }, 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString())
    if (value && value !== 'all' && value !== 'most-followed') next.set(key, value)
    else next.delete(key)
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="relative w-full lg:max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search models…"
          aria-label="Search models"
          className="h-10 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-sm placeholder:text-muted focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs font-medium uppercase tracking-wide text-muted">
          Sort
        </label>
        <select
          value={initialSort}
          onChange={(e) => setParam('sort', e.target.value)}
          className="h-10 rounded-md border border-border bg-surface px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex w-full flex-wrap gap-2 lg:w-auto">
        {CATEGORIES.map((c) => {
          const active =
            (initialCategory || 'all') === c.value ||
            (!initialCategory && c.value === 'all')
          return (
            <button
              key={c.value}
              type="button"
              onClick={() => setParam('category', c.value)}
              aria-pressed={active}
              className={cn(
                'inline-flex h-8 items-center rounded-full border px-3 text-xs font-medium transition-colors',
                active
                  ? 'border-brand-600 bg-brand-600 text-white'
                  : 'border-border bg-surface text-foreground/80 hover:border-brand-500/40 hover:text-foreground'
              )}
            >
              {c.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
