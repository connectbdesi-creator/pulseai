import Link from 'next/link'
import { Users } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Badge } from './Badge'
import { FollowButton } from '@/components/follow/FollowButton'
import type { ModelCategory } from '@/types/database'

type ModelCardProps = {
  modelId: string
  slug: string
  name: string
  maker: string | null
  category: ModelCategory
  followerCount: number
  lastUpdatedAt: string | null
  isAuthenticated: boolean
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
  modelId,
  slug,
  name,
  maker,
  category,
  followerCount,
  lastUpdatedAt,
  isAuthenticated,
  initialFollowing = false,
  className,
}: ModelCardProps) {
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
          <span>{formatFollowers(followerCount)} followers</span>
        </div>
        <span>Updated {formatRelative(lastUpdatedAt)}</span>
      </div>

      <FollowButton
        modelId={modelId}
        modelName={name}
        initialIsFollowing={initialFollowing}
        initialCount={followerCount}
        isAuthenticated={isAuthenticated}
        size="sm"
        className="w-full justify-center"
      />
    </article>
  )
}
