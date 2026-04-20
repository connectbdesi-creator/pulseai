export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse px-4 py-12 sm:px-6 lg:px-8">
      <div className="h-9 w-48 rounded bg-surface-muted" />
      <div className="mt-3 h-4 w-full max-w-md rounded bg-surface-muted" />

      <div className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="h-10 w-full rounded-md bg-surface-muted lg:max-w-sm" />
        <div className="h-10 w-40 rounded-md bg-surface-muted" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-8 w-20 rounded-full bg-surface-muted" />
          ))}
        </div>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            className="h-56 rounded-xl border border-border bg-surface-muted"
          />
        ))}
      </div>
    </div>
  )
}
