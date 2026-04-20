import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendInstantAlert } from '@/lib/notifications/email'
import type { ArticleRow, ModelRow } from '@/types/database'

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

export async function POST(request: NextRequest) {
  const secret = process.env.NOTIFY_SECRET
  if (!secret) {
    return NextResponse.json(
      { error: 'NOTIFY_SECRET not configured' },
      { status: 500 }
    )
  }
  const provided = request.headers.get('x-notify-secret')
  if (!provided || provided !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { articleId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const articleId = body.articleId
  if (!articleId) {
    return NextResponse.json({ error: 'Missing articleId' }, { status: 400 })
  }

  const supabase = serviceClient()

  // 1. Fetch the article.
  const { data: article, error: artErr } = await supabase
    .from('articles')
    .select('id, slug, title, summary, importance, model_ids, category')
    .eq('id', articleId)
    .maybeSingle<
      Pick<
        ArticleRow,
        | 'id'
        | 'slug'
        | 'title'
        | 'summary'
        | 'importance'
        | 'model_ids'
        | 'category'
      >
    >()
  if (artErr) {
    return NextResponse.json({ error: artErr.message }, { status: 500 })
  }
  if (!article) {
    return NextResponse.json({ error: 'Article not found' }, { status: 404 })
  }

  // 2. Find every follow that matches any of the article's models OR its
  //    category. Dedupe to a unique user set.
  const modelIds = article.model_ids ?? []
  const clauses: string[] = []
  if (modelIds.length > 0) {
    clauses.push(`model_id.in.(${modelIds.map((id) => `"${id}"`).join(',')})`)
  }
  if (article.category) {
    clauses.push(`category.eq.${article.category}`)
  }
  if (clauses.length === 0) {
    return NextResponse.json({ sent: 0, failed: 0, skipped: 0 })
  }

  const { data: follows, error: folErr } = await supabase
    .from('follows')
    .select('user_id')
    .or(clauses.join(','))
  if (folErr) {
    return NextResponse.json({ error: folErr.message }, { status: 500 })
  }

  const userIds = Array.from(
    new Set((follows ?? []).map((f) => f.user_id as string))
  )
  if (userIds.length === 0) {
    return NextResponse.json({ sent: 0, failed: 0, skipped: 0 })
  }

  // 3. Fetch users; filter to instant-frequency subscribers who still have
  //    push_enabled (our proxy for "email enabled" until there's a dedicated
  //    column — see unsubscribe route for context).
  const { data: users, error: usrErr } = await supabase
    .from('users')
    .select('id, email, notification_frequency, push_enabled')
    .in('id', userIds)
  if (usrErr) {
    return NextResponse.json({ error: usrErr.message }, { status: 500 })
  }

  const recipients = (users ?? []).filter(
    (u) => u.notification_frequency === 'instant' && u.push_enabled !== false
  ) as Array<{ id: string; email: string }>

  // 4. Pick one primary model name for the "You're following …" footer.
  let primaryModel: Pick<ModelRow, 'name'> = { name: 'PulseAI' }
  if (modelIds.length > 0) {
    const { data: m } = await supabase
      .from('models')
      .select('name')
      .eq('id', modelIds[0])
      .maybeSingle()
    if (m) primaryModel = m
  }

  // 5. Send + log per user.
  let sent = 0
  let failed = 0
  for (const user of recipients) {
    const result = await sendInstantAlert(user.id, article, primaryModel)
    const ok = !result.error
    ok ? sent++ : failed++

    // Best-effort log; don't fail the whole request if the log insert itself
    // errors.
    await supabase.from('notification_log').insert({
      user_id: user.id,
      article_id: article.id,
      channel: 'email',
      status: ok ? 'sent' : 'failed',
    })
    if (!ok) {
      console.error(`[notify] ${user.email}: ${result.error}`)
    }
  }

  return NextResponse.json({
    sent,
    failed,
    skipped: userIds.length - recipients.length,
  })
}
