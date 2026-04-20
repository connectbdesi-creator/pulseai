'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

function resolveSiteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  ).replace(/\/$/, '')
}

// Only allow same-origin relative redirects. Rejects protocol-relative
// (`//evil.com`) and absolute URLs.
function sanitizeRedirect(raw: string | null | undefined): string {
  if (!raw) return '/dashboard'
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/dashboard'
  return raw
}

export async function signInWithMagicLink(
  email: string,
  redirectTo: string
): Promise<{ error: string | null }> {
  const trimmed = (email ?? '').trim()
  if (!trimmed) return { error: 'Enter your email address.' }

  const supabase = await createClient()
  const safeRedirect = sanitizeRedirect(redirectTo)
  const emailRedirectTo = `${resolveSiteUrl()}/auth/callback?redirect=${encodeURIComponent(safeRedirect)}`

  const { error } = await supabase.auth.signInWithOtp({
    email: trimmed,
    options: {
      emailRedirectTo,
      shouldCreateUser: true,
    },
  })

  if (error) return { error: error.message }
  return { error: null }
}

export async function signOut(): Promise<never> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/')
}

export async function getUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}
