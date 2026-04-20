'use client'

import { useOptimistic, useTransition } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Heart, Loader2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import {
  followCategory,
  unfollowCategory,
} from '@/lib/follows/actions'

type CategoryFollowButtonProps = {
  category: string
  categoryLabel: string
  initialIsFollowing: boolean
  initialCount: number
  isAuthenticated: boolean
  size?: 'sm' | 'md'
  className?: string
}

type State = { isFollowing: boolean; count: number }
type Action = 'follow' | 'unfollow'

function formatFollowers(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return `${n}`
}

export function CategoryFollowButton({
  category,
  categoryLabel,
  initialIsFollowing,
  initialCount,
  isAuthenticated,
  size = 'md',
  className,
}: CategoryFollowButtonProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()

  const [state, applyOptimistic] = useOptimistic<State, Action>(
    { isFollowing: initialIsFollowing, count: initialCount },
    (current, action) => ({
      isFollowing: action === 'follow',
      count: Math.max(0, current.count + (action === 'follow' ? 1 : -1)),
    })
  )

  function handleClick() {
    if (!isAuthenticated) {
      router.push(`/login?redirect=${encodeURIComponent(pathname)}`)
      return
    }

    startTransition(async () => {
      const wasFollowing = state.isFollowing
      applyOptimistic(wasFollowing ? 'unfollow' : 'follow')

      const result = wasFollowing
        ? await unfollowCategory(category)
        : await followCategory(category)

      if (!result.error) router.refresh()
    })
  }

  const label = state.isFollowing ? 'Following' : 'Follow'
  const sizing =
    size === 'sm' ? 'h-8 px-3 text-xs' : 'h-10 px-4 text-sm'

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      aria-pressed={state.isFollowing}
      aria-label={
        state.isFollowing
          ? `Unfollow ${categoryLabel}`
          : `Follow ${categoryLabel}`
      }
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border font-medium transition-colors disabled:opacity-60',
        sizing,
        state.isFollowing
          ? 'border-border bg-surface text-foreground hover:border-red-400 hover:text-red-600'
          : 'border-brand-600 bg-brand-600 text-white hover:bg-brand-700',
        className
      )}
    >
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Heart
          className={cn(
            'h-4 w-4',
            state.isFollowing && 'text-red-500'
          )}
          fill={state.isFollowing ? 'currentColor' : 'none'}
        />
      )}
      <span>{label}</span>
      <span
        className={cn(
          'ml-1 rounded px-1.5 py-0.5 text-[11px] font-semibold',
          state.isFollowing
            ? 'bg-surface-muted text-foreground/70'
            : 'bg-white/20 text-white'
        )}
      >
        {formatFollowers(state.count)}
      </span>
    </button>
  )
}
