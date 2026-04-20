'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Loader2,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { Badge } from '@/components/ui/Badge'
import { deleteArticle } from './actions'
import type { ArticleImportance } from '@/types/database'

export type PublishedRow = {
  id: string
  slug: string
  title: string
  importance: ArticleImportance
  published_at: string | null
  model_names: string[]
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

type Props = {
  articles: PublishedRow[]
  page: number
  totalPages: number
}

export function PublishedArticles({ articles, page, totalPages }: Props) {
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  function handleDelete(id: string) {
    if (!confirm('Delete this published article? It will disappear from the site.'))
      return
    setPendingId(id)
    startTransition(async () => {
      const res = await deleteArticle(id)
      if (res.error) {
        setPendingId(null)
        alert(`Delete failed: ${res.error}`)
      }
      // On success, revalidatePath refreshes and the row drops out.
    })
  }

  if (articles.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface-muted p-10 text-center text-sm text-muted">
        No published articles yet.
      </div>
    )
  }

  return (
    <div>
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-surface-muted text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3 hidden md:table-cell">Models</th>
              <th className="px-4 py-3 hidden lg:table-cell">Published</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {articles.map((a) => (
              <tr
                key={a.id}
                className={cn(
                  'border-b border-border align-top last:border-b-0',
                  pendingId === a.id && 'opacity-60'
                )}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="importance" value={a.importance} />
                    <span className="font-medium">{a.title}</span>
                  </div>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <div className="flex flex-wrap gap-1">
                    {a.model_names.slice(0, 2).map((m) => (
                      <Badge key={m} variant="maker" value={m} />
                    ))}
                    {a.model_names.length > 2 && (
                      <span className="text-xs text-muted">
                        +{a.model_names.length - 2}
                      </span>
                    )}
                    {a.model_names.length === 0 && (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 hidden lg:table-cell text-xs text-muted">
                  {formatDate(a.published_at)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <Link
                      href={`/updates/${a.slug}`}
                      target="_blank"
                      title="View public page"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface hover:border-brand-500/40"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                    <button
                      type="button"
                      title="Delete"
                      onClick={() => handleDelete(a.id)}
                      disabled={pendingId !== null}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface hover:border-red-400 hover:text-red-600 disabled:opacity-60"
                    >
                      {pendingId === a.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <nav
          aria-label="Published articles pagination"
          className="mt-4 flex items-center justify-between"
        >
          <PageLink
            disabled={page <= 1}
            page={page > 2 ? page - 1 : null}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </PageLink>
          <span className="text-xs text-muted">
            Page {page} of {totalPages}
          </span>
          <PageLink disabled={page >= totalPages} page={page + 1}>
            Next
            <ChevronRight className="h-4 w-4" />
          </PageLink>
        </nav>
      )}
    </div>
  )
}

function PageLink({
  children,
  page,
  disabled,
}: {
  children: React.ReactNode
  page: number | null
  disabled: boolean
}) {
  const cls =
    'inline-flex h-8 items-center gap-1 rounded-md border border-border bg-surface px-3 text-xs font-medium'
  if (disabled) {
    return <span className={`${cls} pointer-events-none opacity-50`}>{children}</span>
  }
  const href = page ? `/admin?publishedPage=${page}` : '/admin'
  return (
    <Link href={`${href}#published`} className={`${cls} hover:border-brand-500/40`}>
      {children}
    </Link>
  )
}
