import { LogOut } from 'lucide-react'

export function SignOutForm() {
  // Uses the POST-only /auth/signout route — prevents prefetchers from ever
  // signing users out.
  return (
    <form action="/auth/signout" method="POST">
      <button
        type="submit"
        className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-surface px-4 text-sm font-medium hover:border-red-400 hover:text-red-600"
      >
        <LogOut className="h-4 w-4" />
        Sign out
      </button>
    </form>
  )
}
