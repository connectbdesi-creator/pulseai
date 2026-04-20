'use client'

import { useState, useTransition } from 'react'
import { CheckCircle2, Loader2, Mail } from 'lucide-react'
import { signInWithMagicLink } from '@/lib/auth/actions'

type Status = 'idle' | 'sending' | 'sent' | 'error'

export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setStatus('sending')
    setErrorMessage(null)

    startTransition(async () => {
      const result = await signInWithMagicLink(email, redirectTo)
      if (result.error) {
        setErrorMessage(result.error)
        setStatus('error')
      } else {
        setStatus('sent')
      }
    })
  }

  if (status === 'sent') {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
          <CheckCircle2 className="h-6 w-6" />
        </span>
        <h2 className="text-lg font-semibold tracking-tight">
          Check your email ✓
        </h2>
        <p className="text-sm text-muted">
          We sent a magic link to <strong className="text-foreground">{email}</strong>. Click it to sign in — it expires in one hour.
        </p>
        <button
          type="button"
          onClick={() => {
            setStatus('idle')
            setEmail('')
          }}
          className="mt-2 text-xs text-brand-600 hover:text-brand-700"
        >
          Use a different email
        </button>
      </div>
    )
  }

  const busy = pending || status === 'sending'

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-3">
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">Email</span>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="email"
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
            disabled={busy}
            className="h-11 w-full rounded-md border border-border bg-surface pl-10 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 disabled:opacity-60"
          />
        </div>
      </label>

      <button
        type="submit"
        disabled={busy}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-brand-600 px-4 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {busy ? 'Sending…' : 'Send magic link'}
      </button>

      {status === 'error' && errorMessage && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {errorMessage}
        </p>
      )}

      <p className="mt-2 text-center text-xs text-muted">
        No password needed. We&apos;ll email you a link that signs you in.
      </p>
    </form>
  )
}
