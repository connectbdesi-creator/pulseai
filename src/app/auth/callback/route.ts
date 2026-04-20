import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Only allow same-origin relative redirects.
function sanitizeRedirect(raw: string | null): string {
  if (!raw) return '/dashboard'
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/dashboard'
  return raw
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const redirectTo = sanitizeRedirect(url.searchParams.get('redirect'))

  if (!code) {
    return NextResponse.redirect(
      new URL('/login?error=auth_failed', request.url)
    )
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(
      new URL('/login?error=auth_failed', request.url)
    )
  }

  return NextResponse.redirect(new URL(redirectTo, request.url))
}
