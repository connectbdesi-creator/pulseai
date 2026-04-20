import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { ArrowLeft, CalendarDays, Coins, Cpu, Zap } from 'lucide-react'
import { createPublicClient } from '@/lib/supabase/public'
import { createClient } from '@/lib/supabase/server'
import { ArticleCard } from '@/components/ui/ArticleCard'
import { ModelCard } from '@/components/ui/ModelCard'
import { Badge } from '@/components/ui/Badge'
import { FollowButton } from '@/components/follow/FollowButton'
import { Tabs, type TabSpec } from '@/components/ui/Tabs'
import type {
  ArticleRow,
  ModelCategory,
  ModelRow,
} from '@/types/database'

const CATEGORY_TINT: Record<ModelCategory, string> = {
  llm: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
  image: 'bg-pink-500/15 text-pink-700 dark:text-pink-300',
  code: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  audio: 'bg-amber-500/15 text-amber-800 dark:text-amber-300',
  multimodal: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  infrastructure: 'bg-slate-500/15 text-slate-700 dark:text-slate-300',
}

function formatPrice(value: number | null): string {
  if (value == null || value === 0) return '—'
  return `$${value.toFixed(2)}`
}

function formatContext(n: number | null): string {
  if (!n) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`
  return `${n}`
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatRelative(iso: string | null): string {
  if (!iso) return 'Never updated'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'Never updated'
  const diffDays = Math.round((Date.now() - d.getTime()) / 86_400_000)
  if (diffDays < 1) return 'Updated today'
  if (diffDays === 1) return 'Updated yesterday'
  if (diffDays < 30) return `Updated ${diffDays}d ago`
  if (diffDays < 365) return `Updated ${Math.round(diffDays / 30)}mo ago`
  return `Updated ${Math.round(diffDays / 365)}y ago`
}

export async function generateStaticParams() {
  const supabase = createPublicClient()
  const { data } = await supabase
    .from('models')
    .select('slug')
    .eq('is_active', true)
  return (data ?? []).map(({ slug }) => ({ slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const supabase = createPublicClient()
  const { data: model } = await supabase
    .from('models')
    .select('name, maker, description')
    .eq('slug', slug)
    .maybeSingle()

  if (!model) {
    return {
      title: { absolute: 'Model not found — PulseAI' },
    }
  }

  const titleText = `${model.name} Updates & News — PulseAI`
  const description =
    model.description ??
    `Latest news, pricing changes, and capability updates for ${model.name}${model.maker ? ` from ${model.maker}` : ''}.`

  return {
    title: { absolute: titleText },
    description,
    openGraph: {
      title: titleText,
      description,
      type: 'article',
    },
    alternates: {
      canonical: `/models/${slug}`,
    },
  }
}

export default async function ModelDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = createPublicClient()

  const { data: model, error } = await supabase
    .from('models')
    .select('*')
    .eq('slug', slug)
    .maybeSingle<ModelRow>()

  if (error) throw error
  if (!model) notFound()

  // Auth + follow state for the current user (cookie-based client).
  const authed = await createClient()
  const {
    data: { user },
  } = await authed.auth.getUser()
  let isFollowing = false
  if (user) {
    const { count } = await authed
      .from('follows')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('model_id', model.id)
    isFollowing = (count ?? 0) > 0
  }

  const [articlesRes, relatedRes, modelNamesRes] = await Promise.all([
    supabase
      .from('articles')
      .select(
        'id, slug, title, summary, importance, published_at, source_name, model_ids'
      )
      .eq('is_published', true)
      .contains('model_ids', [model.id])
      .order('published_at', { ascending: false, nullsFirst: false }),
    supabase
      .from('models')
      .select(
        'id, slug, name, maker, category, follower_count, last_updated_at'
      )
      .eq('is_active', true)
      .eq('category', model.category)
      .neq('id', model.id)
      .order('follower_count', { ascending: false })
      .limit(3),
    supabase.from('models').select('id, name'),
  ])

  if (articlesRes.error) throw articlesRes.error
  if (relatedRes.error) throw relatedRes.error
  if (modelNamesRes.error) throw modelNamesRes.error

  const articles = (articlesRes.data ?? []) as Pick<
    ArticleRow,
    | 'id'
    | 'slug'
    | 'title'
    | 'summary'
    | 'importance'
    | 'published_at'
    | 'source_name'
    | 'model_ids'
  >[]

  const related = (relatedRes.data ?? []) as Pick<
    ModelRow,
    | 'id'
    | 'slug'
    | 'name'
    | 'maker'
    | 'category'
    | 'follower_count'
    | 'last_updated_at'
  >[]

  const modelNameById = new Map<string, string>(
    (modelNamesRes.data ?? []).map((m) => [m.id as string, m.name as string])
  )

  const changelog = articles.filter(
    (a) => a.importance === 'breaking' || a.importance === 'major'
  )

  const logoLetter = model.name.trim().charAt(0).toUpperCase()

  const updatesTab: TabSpec = {
    id: 'updates',
    label: 'Updates',
    count: articles.length,
    content:
      articles.length === 0 ? (
        <EmptyState>
          No updates published for {model.name} yet. Follow to be notified the
          moment something changes.
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {articles.map((a) => (
            <ArticleCard
              key={a.id}
              slug={a.slug}
              title={a.title}
              summary={a.summary}
              importance={a.importance}
              publishedAt={a.published_at}
              sourceName={a.source_name}
              modelNames={(a.model_ids ?? [])
                .map((id) => modelNameById.get(id))
                .filter((n): n is string => Boolean(n))}
            />
          ))}
        </div>
      ),
  }

  const aboutTab: TabSpec = {
    id: 'about',
    label: 'About',
    content: (
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="sr-only">About {model.name}</h2>
          <p className="text-[15px] leading-relaxed text-foreground/80">
            {model.description ?? 'No description available yet.'}
          </p>
        </div>
        <dl className="rounded-xl border border-border bg-surface p-5 text-sm">
          <SpecRow label="Maker" value={model.maker ?? '—'} />
          <SpecRow label="Category" value={model.category.toUpperCase()} />
          <SpecRow label="Current version" value={model.current_version ?? '—'} />
          <SpecRow label="Context window" value={formatContext(model.context_window)} />
          <SpecRow
            label="Input price"
            value={
              model.pricing_input_per_1m
                ? `${formatPrice(model.pricing_input_per_1m)} / 1M`
                : '—'
            }
          />
          <SpecRow
            label="Output price"
            value={
              model.pricing_output_per_1m
                ? `${formatPrice(model.pricing_output_per_1m)} / 1M`
                : '—'
            }
          />
          <SpecRow label="Released" value={formatDate(model.release_date)} />
        </dl>
      </div>
    ),
  }

  const changelogTab: TabSpec = {
    id: 'changelog',
    label: 'Changelog',
    count: changelog.length,
    content:
      changelog.length === 0 ? (
        <EmptyState>No major changes yet.</EmptyState>
      ) : (
        <ol className="relative border-l border-border pl-6">
          {changelog.map((a) => (
            <li key={a.id} className="mb-8 last:mb-0">
              <span
                className={
                  'absolute -left-[5px] flex h-2.5 w-2.5 items-center justify-center rounded-full ' +
                  (a.importance === 'breaking'
                    ? 'bg-red-500'
                    : 'bg-orange-500')
                }
                aria-hidden
              />
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                <time dateTime={a.published_at ?? undefined}>
                  {formatDate(a.published_at)}
                </time>
                <Badge variant="importance" value={a.importance} />
              </div>
              <Link
                href={`/articles/${a.slug}`}
                className="mt-1 block text-base font-semibold tracking-tight hover:text-brand-600"
              >
                {a.title}
              </Link>
              {a.summary && (
                <p className="mt-1 text-sm leading-relaxed text-foreground/70">
                  {a.summary}
                </p>
              )}
            </li>
          ))}
        </ol>
      ),
  }

  return (
    <>
      {/* Back link */}
      <div className="mx-auto max-w-5xl px-4 pt-8 sm:px-6 lg:px-8">
        <Link
          href="/models"
          className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          All models
        </Link>
      </div>

      {/* Header */}
      <section className="mx-auto max-w-5xl px-4 pt-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div
              className={
                'flex h-16 w-16 shrink-0 items-center justify-center rounded-xl text-2xl font-bold tracking-tight ' +
                CATEGORY_TINT[model.category]
              }
              aria-hidden
            >
              {logoLetter}
            </div>
            <div className="min-w-0">
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                {model.name}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {model.maker && <Badge variant="maker" value={model.maker} />}
                <Badge variant="category" value={model.category} />
                <span className="text-xs text-muted">
                  {formatRelative(model.last_updated_at)}
                </span>
              </div>
            </div>
          </div>

          <div className="sm:shrink-0">
            <FollowButton
              modelId={model.id}
              modelName={model.name}
              initialIsFollowing={isFollowing}
              initialCount={model.follower_count}
              isAuthenticated={Boolean(user)}
            />
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="mx-auto max-w-5xl px-4 pt-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat
            icon={Cpu}
            label="Context window"
            value={formatContext(model.context_window)}
            hint={model.context_window ? 'tokens' : undefined}
          />
          <Stat
            icon={Coins}
            label="Input price"
            value={formatPrice(model.pricing_input_per_1m)}
            hint={model.pricing_input_per_1m ? '/ 1M tokens' : undefined}
          />
          <Stat
            icon={Zap}
            label="Output price"
            value={formatPrice(model.pricing_output_per_1m)}
            hint={model.pricing_output_per_1m ? '/ 1M tokens' : undefined}
          />
          <Stat
            icon={CalendarDays}
            label="Released"
            value={formatDate(model.release_date)}
          />
        </div>
      </section>

      {/* Tabs */}
      <section className="mx-auto max-w-5xl px-4 pt-12 sm:px-6 lg:px-8">
        <Tabs
          ariaLabel="Model content"
          tabs={[updatesTab, aboutTab, changelogTab]}
        />
      </section>

      {/* Related */}
      {related.length > 0 && (
        <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
            Related models
          </h2>
          <p className="mt-1 text-sm text-muted">
            More in the {model.category.toUpperCase()} category.
          </p>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((m) => (
              <ModelCard
                key={m.id}
                slug={m.slug}
                name={m.name}
                maker={m.maker}
                category={m.category}
                followerCount={m.follower_count}
                lastUpdatedAt={m.last_updated_at}
              />
            ))}
          </div>
        </section>
      )}
    </>
  )
}

function Stat({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Cpu
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-2 text-xl font-semibold tracking-tight">{value}</div>
      {hint && <div className="text-xs text-muted">{hint}</div>}
    </div>
  )
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/60 py-2 last:border-b-0">
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  )
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-surface-muted p-10 text-center text-sm text-muted">
      {children}
    </div>
  )
}
