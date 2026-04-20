'use client'

import Link from 'next/link'
import { useMemo, useState, useTransition } from 'react'
import { Loader2, MessageCircle, Reply, Trash2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import { createComment, deleteComment } from '@/lib/comments/actions'

export type CommentRow = {
  id: string
  parent_id: string | null
  body: string
  created_at: string
  author_id: string
  author_label: string
  author_color: string
  is_mine: boolean
}

type CommentSectionProps = {
  articleId: string
  articleSlug: string
  currentUserId: string | null
  comments: CommentRow[]
}

const MAX_DEPTH = 3

function formatTimestamp(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const diff = Date.now() - d.getTime()
  const mins = Math.round(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days}d ago`
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

type TreeNode = CommentRow & { children: TreeNode[] }

function buildTree(flat: CommentRow[]): TreeNode[] {
  const byId = new Map<string, TreeNode>()
  const roots: TreeNode[] = []
  for (const c of flat) byId.set(c.id, { ...c, children: [] })
  for (const c of flat) {
    const node = byId.get(c.id)!
    if (c.parent_id && byId.has(c.parent_id)) {
      byId.get(c.parent_id)!.children.push(node)
    } else {
      roots.push(node)
    }
  }
  // Oldest-first at every level — keeps threads readable.
  const sort = (nodes: TreeNode[]) => {
    nodes.sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )
    for (const n of nodes) sort(n.children)
  }
  sort(roots)
  return roots
}

export function CommentSection({
  articleId,
  articleSlug,
  currentUserId,
  comments,
}: CommentSectionProps) {
  const tree = useMemo(() => buildTree(comments), [comments])
  const total = comments.length

  return (
    <section aria-labelledby="comments-heading" className="mt-12">
      <div className="flex items-center gap-2">
        <MessageCircle className="h-5 w-5 text-muted" />
        <h2 id="comments-heading" className="text-xl font-semibold tracking-tight">
          {total} {total === 1 ? 'comment' : 'comments'}
        </h2>
      </div>

      <div className="mt-6">
        {currentUserId ? (
          <CommentForm
            articleId={articleId}
            articleSlug={articleSlug}
            placeholder="Share your take…"
          />
        ) : (
          <SignInPrompt slug={articleSlug} />
        )}
      </div>

      <ol className="mt-8 flex flex-col gap-6">
        {tree.length === 0 ? (
          <li className="rounded-xl border border-dashed border-border bg-surface-muted p-8 text-center text-sm text-muted">
            Be the first to comment.
          </li>
        ) : (
          tree.map((node) => (
            <CommentNode
              key={node.id}
              node={node}
              depth={0}
              articleId={articleId}
              articleSlug={articleSlug}
              currentUserId={currentUserId}
            />
          ))
        )}
      </ol>
    </section>
  )
}

// ---------------------------------------------------------------------

function CommentNode({
  node,
  depth,
  articleId,
  articleSlug,
  currentUserId,
}: {
  node: TreeNode
  depth: number
  articleId: string
  articleSlug: string
  currentUserId: string | null
}) {
  const [replying, setReplying] = useState(false)
  const [pending, startTransition] = useTransition()
  const [deleted, setDeleted] = useState(false)

  function handleDelete() {
    if (!confirm('Delete this comment?')) return
    startTransition(async () => {
      const res = await deleteComment(node.id, articleSlug)
      if (res.error) {
        alert(res.error)
      } else {
        setDeleted(true)
      }
    })
  }

  if (deleted) return null

  const canNestDeeper = depth < MAX_DEPTH - 1
  const indentStyle: React.CSSProperties = {
    marginLeft: depth === 0 ? 0 : 16,
  }

  return (
    <li style={indentStyle}>
      <article
        className={cn(
          'rounded-xl border border-border bg-surface p-4',
          depth > 0 && 'border-l-2 border-l-brand-500/30'
        )}
      >
        <header className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <span
            aria-hidden
            className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold text-white"
            style={{ backgroundColor: node.author_color }}
          >
            {node.author_label.charAt(0).toUpperCase()}
          </span>
          <span className="font-medium text-foreground/90">
            {node.author_label}
            {node.is_mine && (
              <span className="ml-1 text-[10px] font-normal text-muted">
                (you)
              </span>
            )}
          </span>
          <span>·</span>
          <time dateTime={node.created_at}>
            {formatTimestamp(node.created_at)}
          </time>
        </header>

        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
          {node.body}
        </p>

        <div className="mt-3 flex items-center gap-3 text-xs">
          {currentUserId && canNestDeeper && !replying && (
            <button
              type="button"
              onClick={() => setReplying(true)}
              className="inline-flex items-center gap-1 text-muted hover:text-foreground"
            >
              <Reply className="h-3.5 w-3.5" />
              Reply
            </button>
          )}
          {node.is_mine && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={pending}
              className="inline-flex items-center gap-1 text-muted hover:text-red-600 disabled:opacity-50"
            >
              {pending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              Delete
            </button>
          )}
        </div>

        {replying && (
          <div className="mt-4">
            <CommentForm
              articleId={articleId}
              articleSlug={articleSlug}
              parentId={node.id}
              placeholder={`Reply to ${node.author_label}…`}
              autoFocus
              onDone={() => setReplying(false)}
            />
          </div>
        )}
      </article>

      {node.children.length > 0 && (
        <ol className="mt-3 flex flex-col gap-3">
          {node.children.map((child) => (
            <CommentNode
              key={child.id}
              node={child}
              depth={depth + 1}
              articleId={articleId}
              articleSlug={articleSlug}
              currentUserId={currentUserId}
            />
          ))}
        </ol>
      )}
    </li>
  )
}

// ---------------------------------------------------------------------

function CommentForm({
  articleId,
  articleSlug,
  parentId,
  placeholder,
  autoFocus,
  onDone,
}: {
  articleId: string
  articleSlug: string
  parentId?: string
  placeholder?: string
  autoFocus?: boolean
  onDone?: () => void
}) {
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const text = body.trim()
    if (!text) return
    setError(null)
    startTransition(async () => {
      const res = await createComment({
        articleSlug,
        articleId,
        body: text,
        parentId: parentId ?? null,
      })
      if (res.error) {
        setError(res.error)
      } else {
        setBody('')
        onDone?.()
      }
    })
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-border bg-surface p-3"
    >
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={placeholder ?? 'Add a comment…'}
        rows={3}
        maxLength={4000}
        autoFocus={autoFocus}
        disabled={pending}
        className="w-full resize-y bg-transparent text-sm leading-relaxed placeholder:text-muted focus:outline-none disabled:opacity-60"
      />
      {error && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
      <div className="mt-2 flex items-center justify-end gap-2">
        {onDone && (
          <button
            type="button"
            onClick={onDone}
            disabled={pending}
            className="inline-flex h-8 items-center rounded-md px-3 text-xs text-muted hover:text-foreground"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={pending || !body.trim()}
          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-brand-600 px-3 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          {parentId ? 'Reply' : 'Comment'}
        </button>
      </div>
    </form>
  )
}

function SignInPrompt({ slug }: { slug: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-surface-muted p-6 text-center text-sm text-muted">
      <Link
        href={`/login?redirect=${encodeURIComponent(`/updates/${slug}`)}`}
        className="font-medium text-brand-600 hover:text-brand-700"
      >
        Sign in
      </Link>{' '}
      to join the conversation.
    </div>
  )
}
