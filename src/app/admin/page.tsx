import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import {
  Activity,
  FileText,
  Inbox,
  Radio,
  Users,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { ContentQueue, type QueueArticle } from './ContentQueue'
import {
  PublishedArticles,
  type PublishedRow,
} from './PublishedArticles'
import { ModelManagement, type AdminModel } from './ModelManagement'
import type { ArticleImportance } from '@/types/database'

export const metadata: Metadata = {
  title: 'Admin',
  robots: { index: false, follow: false },
}

const PUBLISHED_PAGE_SIZE = 20

const SOURCES = [
  { label: 'OpenAI', patterns: ['openai.com'] },
  { label: 'Anthropic', patterns: ['anthropic.com'] },
  { label: 'Google AI Blog', patterns: ['blog.google', 'ai.googleblog'] },
  { label: 'Hugging Face', patterns: ['huggingface.co'] },
  {
    label: 'Reddit / HN',
    patterns: ['reddit.com', 'news.ycombinator.com', 'hn.algolia'],
  },
] as const

function service() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase credentials')
  return createServiceClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function startOfToday(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function formatRelative(iso: string | null): string {
  if (!iso) return 'Never'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'Never'
  const diff = Date.now() - d.getTime()
  const mins = Math.round(diff / 60_000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return `${days}d ago`
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ publishedPage?: string }>
}) {
  // --- Auth gate ------------------------------------------------------
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/admin')

  const adminEmail = process.env.ADMIN_EMAIL
  if (!adminEmail || user.email !== adminEmail) {
    redirect('/')
  }

  const sp = await searchParams
  const publishedPage = Math.max(
    1,
    Number.parseInt(sp.publishedPage ?? '1', 10) || 1
  )

  const svc = service()
  const todayStart = startOfToday()
  const dayAgoIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  // --- Parallel fetch -------------------------------------------------
  const [
    articlesTodayRes,
    totalPublishedRes,
    totalUsersRes,
    lastRunRes,
    queueRes,
    publishedRes,
    modelsRes,
    modelNamesRes,
    sourceActivityRes,
  ] = await Promise.all([
    svc
      .from('articles')
      .select('id', { count: 'exact', head: true })
      .eq('is_published', true)
      .gte('published_at', todayStart),
    svc
      .from('articles')
      .select('id', { count: 'exact', head: true })
      .eq('is_published', true),
    svc.from('users').select('id', { count: 'exact', head: true }),
    svc
      .from('processed_items')
      .select('processed_at')
      .order('processed_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    svc
      .from('articles')
      .select(
        'id, title, summary, importance, source_name, source_url, model_ids, model_tags, created_at'
      )
      .eq('is_published', false)
      .order('created_at', { ascending: false })
      .limit(50),
    svc
      .from('articles')
      .select(
        'id, slug, title, importance, published_at, model_ids, model_tags',
        { count: 'exact' }
      )
      .eq('is_published', true)
      .order('published_at', { ascending: false, nullsFirst: false })
      .range(
        (publishedPage - 1) * PUBLISHED_PAGE_SIZE,
        publishedPage * PUBLISHED_PAGE_SIZE - 1
      ),
    svc
      .from('models')
      .select(
        'id, slug, name, maker, category, is_active, follower_count'
      )
      .order('name', { ascending: true }),
    svc.from('models').select('id, name'),
    svc
      .from('processed_items')
      .select('source_url, processed_at')
      .gte('processed_at', dayAgoIso),
  ])

  const modelNameById = new Map<string, string>(
    ((modelNamesRes.data ?? []) as { id: string; name: string }[]).map((m) => [
      m.id,
      m.name,
    ])
  )

  const pickModelNames = (
    ids: string[] | null | undefined,
    tags: string[] | null | undefined
  ): string[] =>
    tags && tags.length > 0
      ? tags
      : (ids ?? [])
          .map((id) => modelNameById.get(id))
          .filter((n): n is string => Boolean(n))

  const queueArticles: QueueArticle[] = (
    (queueRes.data ?? []) as Array<{
      id: string
      title: string
      summary: string | null
      importance: ArticleImportance
      source_name: string | null
      source_url: string | null
      model_ids: string[]
      model_tags: string[] | null
      created_at: string
    }>
  ).map((a) => ({
    id: a.id,
    title: a.title,
    summary: a.summary,
    importance: a.importance,
    source_name: a.source_name,
    source_url: a.source_url,
    model_names: pickModelNames(a.model_ids, a.model_tags),
    created_at: a.created_at,
  }))

  const publishedRows: PublishedRow[] = (
    (publishedRes.data ?? []) as Array<{
      id: string
      slug: string
      title: string
      importance: ArticleImportance
      published_at: string | null
      model_ids: string[]
      model_tags: string[] | null
    }>
  ).map((a) => ({
    id: a.id,
    slug: a.slug,
    title: a.title,
    importance: a.importance,
    published_at: a.published_at,
    model_names: pickModelNames(a.model_ids, a.model_tags),
  }))

  const totalPublished = totalPublishedRes.count ?? 0
  const totalPublishedPages = Math.max(
    1,
    Math.ceil(totalPublished / PUBLISHED_PAGE_SIZE)
  )

  const models = (modelsRes.data ?? []) as AdminModel[]

  // --- Source health (URL-pattern match over last 24h) ---------------
  const sourceCounts = SOURCES.map((s) => {
    const rows = ((sourceActivityRes.data ?? []) as Array<{
      source_url: string | null
      processed_at: string
    }>).filter(
      (r) =>
        r.source_url &&
        s.patterns.some((p) => r.source_url!.toLowerCase().includes(p))
    )
    const lastSeen = rows.length
      ? rows.map((r) => r.processed_at).sort().reverse()[0]
      : null
    return {
      label: s.label,
      count: rows.length,
      lastSeen,
    }
  })

  const stats = {
    today: articlesTodayRes.count ?? 0,
    total: totalPublishedRes.count ?? 0,
    users: totalUsersRes.count ?? 0,
    lastRun:
      (lastRunRes.data as { processed_at: string } | null)?.processed_at ??
      null,
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8 flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Admin
          </h1>
          <p className="mt-1 text-sm text-muted">
            Signed in as <span className="text-foreground">{user.email}</span>
          </p>
        </div>
      </header>

      {/* Stats */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={FileText}
          label="Articles today"
          value={stats.today.toLocaleString()}
        />
        <StatCard
          icon={Activity}
          label="Total published"
          value={stats.total.toLocaleString()}
        />
        <StatCard
          icon={Users}
          label="Total users"
          value={stats.users.toLocaleString()}
        />
        <StatCard
          icon={Radio}
          label="Last pipeline run"
          value={formatRelative(stats.lastRun)}
        />
      </section>

      {/* Content queue */}
      <section id="queue" className="mt-12">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-semibold tracking-tight">
            Content queue
          </h2>
          <span className="inline-flex items-center gap-1 text-sm text-muted">
            <Inbox className="h-4 w-4" />
            {queueArticles.length} pending
          </span>
        </div>
        <div className="mt-4">
          <ContentQueue articles={queueArticles} />
        </div>
      </section>

      {/* Published articles */}
      <section id="published" className="mt-12">
        <h2 className="text-xl font-semibold tracking-tight">
          Published articles
        </h2>
        <div className="mt-4">
          <PublishedArticles
            articles={publishedRows}
            page={publishedPage}
            totalPages={totalPublishedPages}
          />
        </div>
      </section>

      {/* Model management */}
      <section id="models" className="mt-12">
        <h2 className="text-xl font-semibold tracking-tight">
          Model management
        </h2>
        <div className="mt-4">
          <ModelManagement models={models} />
        </div>
      </section>

      {/* Source health */}
      <section id="sources" className="mt-12 mb-12">
        <h2 className="text-xl font-semibold tracking-tight">Source health</h2>
        <p className="mt-1 text-sm text-muted">
          Processed items per source in the last 24h (URL-pattern matched).
        </p>
        <div className="mt-4 overflow-hidden rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface-muted text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3 text-right">Items (24h)</th>
                <th className="px-4 py-3 text-right">Last scraped</th>
              </tr>
            </thead>
            <tbody>
              {sourceCounts.map((s) => (
                <tr
                  key={s.label}
                  className="border-b border-border last:border-b-0"
                >
                  <td className="px-4 py-3 font-medium">{s.label}</td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={
                        s.count === 0
                          ? 'text-muted'
                          : 'text-foreground font-semibold'
                      }
                    >
                      {s.count}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-muted">
                    {formatRelative(s.lastSeen)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof FileText
  label: string
  value: string
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
    </div>
  )
}

