import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyUnsubscribeToken } from '@/lib/notifications/email'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase credentials')
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function page(status: 'ok' | 'bad' | 'error', message: string): NextResponse {
  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  ).replace(/\/$/, '')
  const colour = status === 'ok' ? '#16a34a' : status === 'bad' ? '#dc2626' : '#ea580c'
  const title = status === 'ok' ? 'You&rsquo;re unsubscribed' : 'Link invalid'
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${title}</title></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding:80px 16px;">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;padding:32px;text-align:center;">
<a href="${siteUrl}" style="text-decoration:none;color:#0f172a;font-size:16px;font-weight:600;display:inline-flex;align-items:center;">
  <span style="display:inline-block;width:28px;height:28px;background:#2563eb;color:#ffffff;border-radius:8px;text-align:center;line-height:28px;margin-right:10px;font-size:14px;">⚡</span>PulseAI
</a>
<h1 style="margin:24px 0 8px;font-size:22px;font-weight:600;color:${colour};">${title}</h1>
<p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.55;">${message}</p>
<a href="${siteUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Back to PulseAI</a>
</table></td></tr></table></body></html>`
  return new NextResponse(html, {
    status: status === 'ok' ? 200 : status === 'bad' ? 400 : 500,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

async function applyUnsubscribe(token: string | null): Promise<NextResponse> {
  const userId = verifyUnsubscribeToken(token)
  if (!userId) {
    return page(
      'bad',
      'This unsubscribe link is invalid or has been tampered with. If you keep seeing this, email us and we&rsquo;ll remove you manually.'
    )
  }

  try {
    const supabase = serviceClient()
    // NOTE: schema has no `email_enabled` column. We flip `push_enabled` so
    // this endpoint *does* something persistent — but this only disables
    // browser push, not email. Add an `email_enabled` column + filter in
    // /api/notify to make unsubscribe actually stop email.
    const { error } = await supabase
      .from('users')
      .update({ push_enabled: false })
      .eq('id', userId)
    if (error) {
      return page('error', 'We hit a database error. Try again in a minute.')
    }
    return page(
      'ok',
      'You won&rsquo;t receive push notifications from PulseAI on this account anymore.'
    )
  } catch {
    return page('error', 'Something went wrong. Please try again.')
  }
}

export async function GET(request: NextRequest) {
  const token = new URL(request.url).searchParams.get('token')
  return applyUnsubscribe(token)
}

// Gmail and Yahoo's one-click unsubscribe posts to the URL — support both.
export async function POST(request: NextRequest) {
  const token = new URL(request.url).searchParams.get('token')
  return applyUnsubscribe(token)
}
