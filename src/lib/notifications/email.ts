import { createHmac, timingSafeEqual } from 'node:crypto'
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'
import type {
  ArticleImportance,
  ArticleRow,
  ModelRow,
} from '@/types/database'

// --- Setup ------------------------------------------------------------
function resendClient(): Resend {
  const key = process.env.RESEND_API_KEY
  if (!key) throw new Error('Missing RESEND_API_KEY')
  return new Resend(key)
}

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Missing Supabase URL or service-role key')
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  ).replace(/\/$/, '')
}

function fromAddress(): string {
  // Override via env once you've verified a custom domain in Resend.
  return process.env.EMAIL_FROM ?? 'PulseAI <alerts@pulseai.app>'
}

// --- Unsubscribe tokens ----------------------------------------------
// HMAC-SHA256(userId, secret). No expiry — users expect unsubscribe links
// from any past email to keep working forever.
function secretOrThrow(): string {
  const s = process.env.NOTIFY_SECRET
  if (!s) throw new Error('Missing NOTIFY_SECRET')
  return s
}

export function buildUnsubscribeLink(userId: string): string {
  const sig = createHmac('sha256', secretOrThrow())
    .update(userId)
    .digest('base64url')
  return `${siteUrl()}/api/unsubscribe?token=${userId}.${sig}`
}

export function verifyUnsubscribeToken(token: string | null): string | null {
  if (!token || typeof token !== 'string') return null
  const dot = token.indexOf('.')
  if (dot <= 0 || dot === token.length - 1) return null
  const userId = token.slice(0, dot)
  const sig = token.slice(dot + 1)

  let expected: string
  try {
    expected = createHmac('sha256', secretOrThrow())
      .update(userId)
      .digest('base64url')
  } catch {
    return null
  }

  if (sig.length !== expected.length) return null
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (!timingSafeEqual(a, b)) return null
  return userId
}

// --- Templates --------------------------------------------------------
const IMPORTANCE_STYLE: Record<
  ArticleImportance,
  { bg: string; label: string }
> = {
  breaking: { bg: '#dc2626', label: 'BREAKING' },
  major: { bg: '#ea580c', label: 'MAJOR' },
  minor: { bg: '#64748b', label: 'UPDATE' },
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function shell(inner: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td align="center" style="padding:40px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
<tr><td style="padding:20px 32px;border-bottom:1px solid #e2e8f0;">
  <a href="${siteUrl()}" style="text-decoration:none;color:#0f172a;font-size:16px;font-weight:600;display:inline-flex;align-items:center;">
    <span style="display:inline-block;width:28px;height:28px;background:#2563eb;color:#ffffff;border-radius:8px;text-align:center;line-height:28px;margin-right:10px;font-size:14px;">⚡</span>
    PulseAI
  </a>
</td></tr>
${inner}
</table>
</td></tr>
</table>
</body>
</html>`
}

function buildInstantHtml({
  article,
  modelName,
  unsubscribeUrl,
}: {
  article: Pick<ArticleRow, 'slug' | 'title' | 'summary' | 'importance'>
  modelName: string
  unsubscribeUrl: string
}): string {
  const imp = IMPORTANCE_STYLE[article.importance]
  const articleUrl = `${siteUrl()}/updates/${encodeURIComponent(article.slug)}`
  const safeTitle = escapeHtml(article.title)
  const safeSummary = escapeHtml(article.summary ?? '')
  const safeModel = escapeHtml(modelName)

  const content = `
<tr><td style="padding:32px;">
  <span style="display:inline-block;background:${imp.bg};color:#ffffff;padding:4px 12px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:0.08em;">${imp.label}</span>
  <h1 style="margin:16px 0 8px;font-size:22px;line-height:1.3;font-weight:600;">
    <a href="${articleUrl}" style="color:#0f172a;text-decoration:none;">${safeTitle}</a>
  </h1>
  ${safeSummary ? `<p style="margin:0 0 24px;color:#475569;line-height:1.6;font-size:15px;">${safeSummary}</p>` : ''}
  <a href="${articleUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Read full update →</a>
</td></tr>
<tr><td style="padding:20px 32px;border-top:1px solid #e2e8f0;background:#f8fafc;">
  <p style="margin:0;color:#64748b;font-size:13px;line-height:1.6;">
    You're following <strong style="color:#0f172a;">${safeModel}</strong> · <a href="${unsubscribeUrl}" style="color:#64748b;text-decoration:underline;">Unsubscribe</a>
  </p>
</td></tr>`
  return shell(content)
}

function buildDigestHtml({
  articles,
  unsubscribeUrl,
  dateLabel,
}: {
  articles: Pick<ArticleRow, 'slug' | 'title' | 'summary' | 'importance'>[]
  unsubscribeUrl: string
  dateLabel: string
}): string {
  const rows = articles
    .map((a) => {
      const imp = IMPORTANCE_STYLE[a.importance]
      const articleUrl = `${siteUrl()}/updates/${encodeURIComponent(a.slug)}`
      return `
<tr><td style="padding:20px 0;border-bottom:1px solid #e2e8f0;">
  <span style="display:inline-block;background:${imp.bg};color:#ffffff;padding:2px 10px;border-radius:999px;font-size:10px;font-weight:700;letter-spacing:0.08em;">${imp.label}</span>
  <h2 style="margin:8px 0 6px;font-size:17px;line-height:1.35;font-weight:600;">
    <a href="${articleUrl}" style="color:#0f172a;text-decoration:none;">${escapeHtml(a.title)}</a>
  </h2>
  ${a.summary ? `<p style="margin:0 0 8px;color:#475569;font-size:14px;line-height:1.55;">${escapeHtml(a.summary)}</p>` : ''}
  <a href="${articleUrl}" style="color:#2563eb;text-decoration:none;font-size:13px;font-weight:500;">Read →</a>
</td></tr>`
    })
    .join('')

  const content = `
<tr><td style="padding:32px;">
  <h1 style="margin:0 0 8px;font-size:20px;font-weight:600;">Your AI model updates</h1>
  <p style="margin:0 0 16px;color:#64748b;font-size:14px;">${escapeHtml(dateLabel)} · ${articles.length} ${articles.length === 1 ? 'update' : 'updates'}</p>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    ${rows}
  </table>
</td></tr>
<tr><td style="padding:20px 32px;border-top:1px solid #e2e8f0;background:#f8fafc;">
  <p style="margin:0;color:#64748b;font-size:13px;line-height:1.6;">
    Digest from PulseAI · <a href="${unsubscribeUrl}" style="color:#64748b;text-decoration:underline;">Unsubscribe</a>
  </p>
</td></tr>`
  return shell(content)
}

// --- Public senders ---------------------------------------------------

async function fetchUserEmail(userId: string): Promise<string | null> {
  const supabase = serviceClient()
  const { data } = await supabase
    .from('users')
    .select('email')
    .eq('id', userId)
    .maybeSingle()
  return data?.email ?? null
}

export async function sendInstantAlert(
  userId: string,
  article: Pick<
    ArticleRow,
    'id' | 'slug' | 'title' | 'summary' | 'importance'
  >,
  model: Pick<ModelRow, 'name'>
): Promise<{ messageId: string | null; error: string | null }> {
  const email = await fetchUserEmail(userId)
  if (!email) return { messageId: null, error: 'User has no email on file' }

  const unsubscribeUrl = buildUnsubscribeLink(userId)
  const subject =
    article.importance === 'breaking'
      ? `🔴 Breaking: ${article.title}`
      : `⚡ ${article.title}`

  try {
    const { data, error } = await resendClient().emails.send({
      from: fromAddress(),
      to: email,
      subject,
      html: buildInstantHtml({
        article,
        modelName: model.name,
        unsubscribeUrl,
      }),
      headers: {
        'List-Unsubscribe': `<${unsubscribeUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    })
    if (error) return { messageId: null, error: error.message }
    return { messageId: data?.id ?? null, error: null }
  } catch (err) {
    return {
      messageId: null,
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}

export async function sendDailyDigest(
  userId: string,
  articles: Pick<
    ArticleRow,
    'id' | 'slug' | 'title' | 'summary' | 'importance'
  >[]
): Promise<{ messageId: string | null; error: string | null }> {
  if (articles.length === 0) {
    return { messageId: null, error: 'No articles to include in digest' }
  }
  const email = await fetchUserEmail(userId)
  if (!email) return { messageId: null, error: 'User has no email on file' }

  const unsubscribeUrl = buildUnsubscribeLink(userId)
  const dateLabel = new Date().toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  try {
    const { data, error } = await resendClient().emails.send({
      from: fromAddress(),
      to: email,
      subject: `Your AI model updates for ${dateLabel}`,
      html: buildDigestHtml({ articles, unsubscribeUrl, dateLabel }),
      headers: {
        'List-Unsubscribe': `<${unsubscribeUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    })
    if (error) return { messageId: null, error: error.message }
    return { messageId: data?.id ?? null, error: null }
  } catch (err) {
    return {
      messageId: null,
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}
