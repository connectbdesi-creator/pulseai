export default function Loading() {
  return (
    <div className="animate-pulse">
      {/* Hero skeleton */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="mx-auto max-w-3xl space-y-5 text-center">
            <div className="mx-auto h-6 w-64 rounded-full bg-surface-muted" />
            <div className="mx-auto h-12 w-full max-w-xl rounded-lg bg-surface-muted" />
            <div className="mx-auto h-5 w-full max-w-md rounded bg-surface-muted" />
            <div className="mx-auto mt-4 h-11 w-56 rounded-md bg-surface-muted" />
          </div>
        </div>
      </section>

      {/* Trending row skeleton */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="h-7 w-64 rounded bg-surface-muted" />
        <div className="mt-6 flex gap-4 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-48 w-80 shrink-0 rounded-xl border border-border bg-surface-muted"
            />
          ))}
        </div>
      </section>

      {/* Feed skeleton */}
      <div className="border-y border-border bg-surface-muted/40">
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="h-7 w-40 rounded bg-surface-muted" />
          <div className="mt-6 flex gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-8 w-20 rounded-full bg-surface-muted" />
            ))}
          </div>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <div
                key={i}
                className="h-44 rounded-xl border border-border bg-surface-muted"
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
