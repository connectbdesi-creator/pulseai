'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/cn'

const IMPORTANCE = [
  { value: '', label: 'All importance' },
  { value: 'breaking', label: 'Breaking' },
  { value: 'major', label: 'Major' },
  { value: 'minor', label: 'Minor' },
] as const

const CATEGORIES = [
  { value: '', label: 'All categories' },
  { value: 'llm', label: 'LLMs' },
  { value: 'image', label: 'Image' },
  { value: 'code', label: 'Code' },
  { value: 'audio', label: 'Audio' },
  { value: 'multimodal', label: 'Multimodal' },
  { value: 'infrastructure', label: 'Infrastructure' },
] as const

type UpdatesFiltersProps = {
  initialImportance: string
  initialCategory: string
  initialMaker: string
  makers: string[]
}

export function UpdatesFilters({
  initialImportance,
  initialCategory,
  initialMaker,
  makers,
}: UpdatesFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString())
    if (value) next.set(key, value)
    else next.delete(key)
    // Reset pagination on any filter change
    next.delete('page')
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  const selectCls =
    'h-10 rounded-md border border-border bg-surface px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30'

  return (
    <div className={cn('flex flex-wrap items-center gap-3')}>
      <select
        aria-label="Filter by importance"
        value={initialImportance}
        onChange={(e) => setParam('importance', e.target.value)}
        className={selectCls}
      >
        {IMPORTANCE.map((i) => (
          <option key={i.value} value={i.value}>
            {i.label}
          </option>
        ))}
      </select>

      <select
        aria-label="Filter by category"
        value={initialCategory}
        onChange={(e) => setParam('category', e.target.value)}
        className={selectCls}
      >
        {CATEGORIES.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>

      <select
        aria-label="Filter by maker"
        value={initialMaker}
        onChange={(e) => setParam('maker', e.target.value)}
        className={selectCls}
      >
        <option value="">All makers</option>
        {makers.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
    </div>
  )
}
