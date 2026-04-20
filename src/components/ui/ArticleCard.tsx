import Link from 'next/link'
import { Clock } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Badge } from './Badge'
import type { ArticleImportance } from '@/types/database'

type ArticleCardProps = {
  slug: string
  title: string
  summary: string | null
  importance: ArticleImportance
  publishedAt: string | null
  sourceName: string | null
  modelNames?: string[]
  readTimeMinutes?: number
  className?: string
}

function formatDate(iso: string | null) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function estimateReadTime(summary: string | null) {
  if (!summary) return 1
  const words = summary.trim().split(/\s+/).length
  return Math.max(1, Math.round(words / 200))
}

export function ArticleCard({
  slug,
  title,
  summary,
  importance,
  publishedAt,
  sourceName,
  modelNames = [],
  readTimeMinutes,
  className,
}: ArticleCardProps) {
  const date = formatDate(publishedAt)
  const readTime = readTimeMinutes ?? estimateReadTime(summary)

  return (
    <article
      className={cn(
        'group flex flex-col gap-3 rounded-xl border border-border bg-surface p-5 transition-colors hover:border-brand-500/40',
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="importance" value={importance} />
        {modelNames.slice(0, 3).map((name) => (
          <Badge key={name} variant="maker" value={name} />
        ))}
        {modelNames.length > 3 && (
          <span className="text-xs text-muted">
            +{modelNames.length - 3} more
          </span>
        )}
      </div>

      <Link href={`/articles/${slug}`} className="outline-none">
        <h3 className="text-lg font-semibold leading-snug tracking-tight group-hover:text-brand-600">
          {title}
        </h3>
      </Link>

      {summary && (
        <p className="line-clamp-3 text-sm leading-relaxed text-foreground/70">
          {summary}
        </p>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 text-xs text-muted">
        {date && <span>{date}</span>}
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" />
          {readTime} min read
        </span>
        {sourceName && (
          <>
            <span aria-hidden>·</span>
            <span className="truncate">{sourceName}</span>
          </>
        )}
      </div>
    </article>
  )
}
