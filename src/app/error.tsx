'use client'

import { useEffect } from 'react'
import { RotateCcw, TriangleAlert } from 'lucide-react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Homepage render error:', error)
  }, [error])

  return (
    <section className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-4 px-4 py-20 text-center sm:px-6">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-600 dark:text-red-300">
        <TriangleAlert className="h-6 w-6" />
      </span>
      <h1 className="text-2xl font-semibold tracking-tight">
        Something went wrong
      </h1>
      <p className="text-sm text-muted">
        We couldn&apos;t load the feed. This is usually temporary — try again in a
        moment.
      </p>
      {error.digest && (
        <p className="text-xs text-muted/80">Reference: {error.digest}</p>
      )}
      <button
        type="button"
        onClick={reset}
        className="mt-2 inline-flex h-10 items-center gap-2 rounded-md bg-brand-600 px-5 text-sm font-medium text-white hover:bg-brand-700"
      >
        <RotateCcw className="h-4 w-4" />
        Try again
      </button>
    </section>
  )
}
