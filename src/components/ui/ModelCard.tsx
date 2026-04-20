'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Check, Plus, Users } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Badge } from './Badge'
import type { ModelCategory } from '@/types/database'

type ModelCardProps = {
  slug: string
  name: string
  maker: string | null
  category: ModelCategory
  followerCount: number
  lastUpdatedAt: string | null
  initialFollowing?: boolean
  className?: string
}

function formatRelative(iso: string | null) {
  if (!iso) return 'Never updated'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'Never updated'
  const diffMs = Date.now() - d.getTime()
  const mins = Math.round(diffMs / 60_000)
  if (mins < 60) return `${Math.max(mins, 1)}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.round(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.round(months / 12)}y ago`
}

function formatFollowers(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return `${n}`
}

export function ModelCard({
  slug,
  name,
  maker,
  category,
  followerCount,
  lastUpdatedAt,
  initialFollowing = false,
  className,
}: ModelCardProps) {
  const [following, setFollowing] = useState(initialFollowing)
  const count = followerCount + (following && !initialFollowing ? 1 : 0)

  return (
    <article
      className={cn(
        'group relative flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 transition-colors hover:border-brand-500/40',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/models/${slug}`}
            className="block text-lg font-semibold tracking-tight outline-none hover:text-brand-600 focus-visible:text-brand-600"
          >
            {name}
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {maker && <Badge variant="maker" value={maker} />}
            <Badge variant="category" value={category} />
          </div>
        </div>
      </div>

      <div className="mt-auto flex items-center justify-between gap-3 pt-2 text-xs text-muted">
        <div className="flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" />
          <span>{formatFollowers(count)} followers</span>
        </div>
        <span>Updated {formatRelative(lastUpdatedAt)}</span>
      </div>

      <button
        type="button"
        onClick={() => setFollowing((v) => !v)}
        aria-pressed={following}
        className={cn(
          'inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors',
          following
            ? 'bg-surface-muted text-foreground border border-border hover:border-red-400 hover:text-red-600'
            : 'bg-brand-600 text-white hover:bg-brand-700'
        )}
      >
        {following ? (
          <>
            <Check className="h-4 w-4" />
            Following
          </>
        ) : (
          <>
            <Plus className="h-4 w-4" />
            Follow
          </>
        )}
      </button>
    </article>
  )
}
