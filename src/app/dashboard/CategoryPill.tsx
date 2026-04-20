'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, X } from 'lucide-react'
import { unfollowCategory } from '@/lib/follows/actions'

export function CategoryPill({
  category,
  label,
}: {
  category: string
  label: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function handleUnfollow() {
    startTransition(async () => {
      const result = await unfollowCategory(category)
      if (!result.error) router.refresh()
    })
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-3 py-1 text-sm">
      {label}
      <button
        type="button"
        onClick={handleUnfollow}
        disabled={pending}
        aria-label={`Unfollow ${label}`}
        className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-muted hover:bg-surface-muted hover:text-red-600 disabled:opacity-60"
      >
        {pending ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <X className="h-3 w-3" />
        )}
      </button>
    </span>
  )
}
