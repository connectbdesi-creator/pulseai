import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Zap } from 'lucide-react'
import { LoginForm } from './LoginForm'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Sign in',
  description:
    'Sign in to PulseAI to follow AI models and get notified when they change.',
}

function sanitizeRedirect(raw: string | undefined): string {
  if (!raw) return '/dashboard'
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/dashboard'
  return raw
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; error?: string }>
}) {
  const { redirect: redirectParam, error } = await searchParams
  const redirectTo = sanitizeRedirect(redirectParam)

  // If already signed in, bounce to the redirect target.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) redirect(redirectTo)

  return (
    <div className="mx-auto flex min-h-[calc(100vh-10rem)] w-full max-w-md flex-col justify-center px-4 py-12 sm:px-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <Link
          href="/"
          aria-label="PulseAI home"
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white"
        >
          <Zap className="h-5 w-5" strokeWidth={2.5} />
        </Link>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">
          Sign in to PulseAI
        </h1>
        <p className="text-sm text-muted">
          Follow the AI models that matter to you.
        </p>
      </div>

      <div className="mt-8 rounded-xl border border-border bg-surface p-6">
        {error === 'auth_failed' && (
          <div
            role="alert"
            className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300"
          >
            We couldn&apos;t sign you in. The link may have expired — try again.
          </div>
        )}
        <LoginForm redirectTo={redirectTo} />
      </div>
    </div>
  )
}
