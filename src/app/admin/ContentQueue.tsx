'use client'

import { useState, useTransition } from 'react'
import { Check, Loader2, Pencil, Trash2, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Badge } from '@/components/ui/Badge'
import {
  approveArticle,
  deleteArticle,
  updateArticle,
} from './actions'
import type { ArticleImportance } from '@/types/database'

export type QueueArticle = {
  id: string
  title: string
  summary: string | null
  importance: ArticleImportance
  source_name: string | null
  source_url: string | null
  model_names: string[]
  created_at: string
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

type Row = {
  article: QueueArticle
  editing: boolean
  draftTitle: string
  draftSummary: string
  draftImportance: ArticleImportance
  pendingAction: 'approve' | 'delete' | 'save' | null
  error: string | null
}

export function ContentQueue({ articles }: { articles: QueueArticle[] }) {
  const [rows, setRows] = useState<Row[]>(() =>
    articles.map((a) => ({
      article: a,
      editing: false,
      draftTitle: a.title,
      draftSummary: a.summary ?? '',
      draftImportance: a.importance,
      pendingAction: null,
      error: null,
    }))
  )
  const [, startTransition] = useTransition()

  function update(id: string, patch: Partial<Row>) {
    setRows((rs) =>
      rs.map((r) => (r.article.id === id ? { ...r, ...patch } : r))
    )
  }

  function handleApprove(id: string) {
    update(id, { pendingAction: 'approve', error: null })
    startTransition(async () => {
      const res = await approveArticle(id)
      if (res.error) {
        update(id, { pendingAction: null, error: res.error })
      }
      // On success, router cache revalidates and the row falls out on the next render.
    })
  }

  function handleDelete(id: string) {
    if (!confirm('Delete this draft? This cannot be undone.')) return
    update(id, { pendingAction: 'delete', error: null })
    startTransition(async () => {
      const res = await deleteArticle(id)
      if (res.error) {
        update(id, { pendingAction: null, error: res.error })
      }
    })
  }

  function handleSave(id: string) {
    const row = rows.find((r) => r.article.id === id)
    if (!row) return
    update(id, { pendingAction: 'save', error: null })
    startTransition(async () => {
      const res = await updateArticle(id, {
        title: row.draftTitle,
        summary: row.draftSummary || null,
        importance: row.draftImportance,
      })
      if (res.error) {
        update(id, { pendingAction: null, error: res.error })
      } else {
        update(id, {
          editing: false,
          pendingAction: null,
          article: {
            ...row.article,
            title: row.draftTitle,
            summary: row.draftSummary || null,
            importance: row.draftImportance,
          },
        })
      }
    })
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface-muted p-10 text-center text-sm text-muted">
        Queue is empty — every article has been approved or removed.
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-surface-muted text-left text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="px-4 py-3">Title</th>
            <th className="px-4 py-3 hidden md:table-cell">Models</th>
            <th className="px-4 py-3">Importance</th>
            <th className="px-4 py-3 hidden lg:table-cell">Source</th>
            <th className="px-4 py-3 hidden lg:table-cell">Created</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(
            ({
              article: a,
              editing,
              draftTitle,
              draftSummary,
              draftImportance,
              pendingAction,
              error,
            }) => {
              const busy = pendingAction !== null
              return (
                <tr
                  key={a.id}
                  className={cn(
                    'border-b border-border align-top last:border-b-0',
                    busy && 'opacity-60'
                  )}
                >
                  <td className="px-4 py-3">
                    {editing ? (
                      <div className="flex flex-col gap-2">
                        <input
                          type="text"
                          value={draftTitle}
                          onChange={(e) =>
                            update(a.id, { draftTitle: e.target.value })
                          }
                          className="h-9 w-full rounded-md border border-border bg-surface px-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                        />
                        <textarea
                          rows={3}
                          value={draftSummary}
                          onChange={(e) =>
                            update(a.id, { draftSummary: e.target.value })
                          }
                          placeholder="Summary"
                          className="w-full rounded-md border border-border bg-surface p-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                        />
                        {error && (
                          <p className="text-xs text-red-600 dark:text-red-400">
                            {error}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div>
                        <div className="font-medium">{a.title}</div>
                        {a.summary && (
                          <div className="mt-1 line-clamp-2 text-xs text-muted">
                            {a.summary}
                          </div>
                        )}
                        {error && (
                          <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                            {error}
                          </p>
                        )}
                      </div>
                    )}
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
                  <td className="px-4 py-3">
                    {editing ? (
                      <select
                        value={draftImportance}
                        onChange={(e) =>
                          update(a.id, {
                            draftImportance: e.target
                              .value as ArticleImportance,
                          })
                        }
                        className="h-9 rounded-md border border-border bg-surface px-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                      >
                        <option value="breaking">Breaking</option>
                        <option value="major">Major</option>
                        <option value="minor">Minor</option>
                      </select>
                    ) : (
                      <Badge variant="importance" value={a.importance} />
                    )}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {a.source_url ? (
                      <a
                        href={a.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-brand-600 hover:text-brand-700"
                      >
                        {a.source_name ?? 'source'}
                      </a>
                    ) : (
                      <span className="text-xs text-muted">
                        {a.source_name ?? '—'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-xs text-muted">
                    {formatDate(a.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {editing ? (
                        <>
                          <IconBtn
                            title="Save"
                            onClick={() => handleSave(a.id)}
                            disabled={busy}
                            variant="primary"
                          >
                            {pendingAction === 'save' ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Check className="h-4 w-4" />
                            )}
                          </IconBtn>
                          <IconBtn
                            title="Cancel"
                            onClick={() =>
                              update(a.id, {
                                editing: false,
                                draftTitle: a.title,
                                draftSummary: a.summary ?? '',
                                draftImportance: a.importance,
                                error: null,
                              })
                            }
                            disabled={busy}
                          >
                            <X className="h-4 w-4" />
                          </IconBtn>
                        </>
                      ) : (
                        <>
                          <IconBtn
                            title="Approve & publish"
                            onClick={() => handleApprove(a.id)}
                            disabled={busy}
                            variant="primary"
                          >
                            {pendingAction === 'approve' ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Check className="h-4 w-4" />
                            )}
                          </IconBtn>
                          <IconBtn
                            title="Edit"
                            onClick={() => update(a.id, { editing: true })}
                            disabled={busy}
                          >
                            <Pencil className="h-4 w-4" />
                          </IconBtn>
                          <IconBtn
                            title="Delete"
                            onClick={() => handleDelete(a.id)}
                            disabled={busy}
                            variant="danger"
                          >
                            {pendingAction === 'delete' ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </IconBtn>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )
            }
          )}
        </tbody>
      </table>
    </div>
  )
}

function IconBtn({
  children,
  onClick,
  disabled,
  title,
  variant = 'neutral',
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  title: string
  variant?: 'neutral' | 'primary' | 'danger'
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors disabled:opacity-60',
        variant === 'primary' &&
          'border-brand-600 bg-brand-600 text-white hover:bg-brand-700',
        variant === 'danger' &&
          'border-border bg-surface hover:border-red-400 hover:text-red-600',
        variant === 'neutral' &&
          'border-border bg-surface hover:border-brand-500/40'
      )}
    >
      {children}
    </button>
  )
}
