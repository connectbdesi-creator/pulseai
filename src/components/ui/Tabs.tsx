'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type TabSpec = {
  id: string
  label: string
  count?: number
  content: ReactNode
}

type TabsProps = {
  tabs: TabSpec[]
  ariaLabel?: string
  className?: string
}

// Hash-synced tabs. All panels render to the DOM (only one unhidden) so
// content stays crawlable by search engines; switching doesn't re-fetch.
export function Tabs({ tabs, ariaLabel = 'Content', className }: TabsProps) {
  const [active, setActive] = useState(tabs[0]?.id ?? '')

  useEffect(() => {
    const hash = window.location.hash.slice(1)
    if (hash && tabs.some((t) => t.id === hash)) setActive(hash)
  }, [tabs])

  function select(id: string) {
    setActive(id)
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `#${id}`)
    }
  }

  return (
    <div className={className}>
      <div
        role="tablist"
        aria-label={ariaLabel}
        className="flex gap-1 overflow-x-auto border-b border-border"
      >
        {tabs.map((tab) => {
          const isActive = active === tab.id
          return (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              role="tab"
              aria-selected={isActive}
              aria-controls={`tabpanel-${tab.id}`}
              onClick={() => select(tab.id)}
              className={cn(
                'relative -mb-px inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors',
                isActive
                  ? 'border-brand-600 text-foreground'
                  : 'border-transparent text-muted hover:text-foreground'
              )}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-xs font-semibold',
                    isActive
                      ? 'bg-brand-600/10 text-brand-700 dark:text-brand-300'
                      : 'bg-surface-muted text-muted'
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {tabs.map((tab) => (
        <div
          key={tab.id}
          id={`tabpanel-${tab.id}`}
          role="tabpanel"
          aria-labelledby={`tab-${tab.id}`}
          hidden={active !== tab.id}
          className="pt-8"
        >
          {tab.content}
        </div>
      ))}
    </div>
  )
}
