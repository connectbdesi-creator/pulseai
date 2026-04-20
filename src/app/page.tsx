import Link from 'next/link'
import {
  ArrowRight,
  Bell,
  Code,
  Cpu,
  Image as ImageIcon,
  Layers,
  MessageSquare,
  Music,
  Plus,
  Server,
  Sparkles,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getFollowContext } from '@/lib/follows/context'
import { ModelCard } from '@/components/ui/ModelCard'
import {
  ArticlesFeed,
  type FeedArticle,
} from '@/components/home/ArticlesFeed'
import type {
  ArticleImportance,
  ModelCategory,
  ModelRow,
} from '@/types/database'

type TrendingModel = Pick<
  ModelRow,
  | 'id'
  | 'slug'
  | 'name'
  | 'maker'
  | 'category'
  | 'follower_count'
  | 'last_updated_at'
>

type ArticleWithModels = {
  id: string
  slug: string
  title: string
  summary: string | null
  importance: ArticleImportance
  published_at: string | null
  source_name: string | null
  category: string | null
  model_ids: string[]
  model_tags: string[] | null
}

const CATEGORY_META: Record<
  ModelCategory,
  { label: string; icon: typeof MessageSquare; tint: string }
> = {
  llm: {
    label: 'LLMs',
    icon: MessageSquare,
    tint: 'bg-violet-500/10 text-violet-600 dark:text-violet-300',
  },
  image: {
    label: 'Image',
    icon: ImageIcon,
    tint: 'bg-pink-500/10 text-pink-600 dark:text-pink-300',
  },
  code: {
    label: 'Code',
    icon: Code,
    tint: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
  },
  audio: {
    label: 'Audio',
    icon: Music,
    tint: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  },
  multimodal: {
    label: 'Multimodal',
    icon: Layers,
    tint: 'bg-sky-500/10 text-sky-600 dark:text-sky-300',
  },
  infrastructure: {
    label: 'Infrastructure',
    icon: Server,
    tint: 'bg-slate-500/10 text-slate-700 dark:text-slate-300',
  },
}

const CATEGORY_ORDER: ModelCategory[] = [
  'llm',
  'image',
  'code',
  'audio',
  'multimodal',
  'infrastructure',
]

export default async function HomePage() {
  const supabase = await createClient()

  const [trendingRes, articlesRes, modelNamesRes, categoryCountsRes] =
    await Promise.all([
      supabase
        .from('models')
        .select(
          'id, slug, name, maker, category, follower_count, last_updated_at'
        )
        .eq('is_active', true)
        .order('follower_count', { ascending: false })
        .limit(6),
      supabase
        .from('articles')
        .select(
          'id, slug, title, summary, importance, published_at, source_name, category, model_ids, model_tags'
        )
        .eq('is_published', true)
        .order('published_at', { ascending: false, nullsFirst: false })
        .limit(36),
      supabase.from('models').select('id, name'),
      supabase.from('models').select('category').eq('is_active', true),
    ])

  if (trendingRes.error) throw trendingRes.error
  if (articlesRes.error) throw articlesRes.error
  if (modelNamesRes.error) throw modelNamesRes.error
  if (categoryCountsRes.error) throw categoryCountsRes.error

  const trending = (trendingRes.data ?? []) as TrendingModel[]
  const articles = (articlesRes.data ?? []) as ArticleWithModels[]

  const { user, followedModelIds } = await getFollowContext({
    modelIds: trending.map((m) => m.id),
  })

  const modelNameById = new Map<string, string>(
    (modelNamesRes.data ?? []).map((m) => [m.id as string, m.name as string])
  )

  const feedArticles: FeedArticle[] = articles.map((a) => ({
    id: a.id,
    slug: a.slug,
    title: a.title,
    summary: a.summary,
    importance: a.importance,
    published_at: a.published_at,
    source_name: a.source_name,
    category: a.category,
    // Prefer writer-supplied tags (always human-readable). Fall back to
    // names resolved from model_ids for older articles that predate the
    // model_tags column.
    model_names:
      a.model_tags && a.model_tags.length > 0
        ? a.model_tags
        : (a.model_ids ?? [])
            .map((id) => modelNameById.get(id))
            .filter((name): name is string => Boolean(name)),
  }))

  const categoryCounts = (categoryCountsRes.data ?? []).reduce<
    Record<ModelCategory, number>
  >(
    (acc, row) => {
      const key = row.category as ModelCategory
      acc[key] = (acc[key] ?? 0) + 1
      return acc
    },
    {
      llm: 0,
      image: 0,
      code: 0,
      audio: 0,
      multimodal: 0,
      infrastructure: 0,
    }
  )

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-32 h-[32rem] bg-[radial-gradient(ellipse_at_top,rgba(37,99,235,0.15),transparent_60%)]"
        />
        <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-600/30 bg-brand-600/10 px-3 py-1 text-xs font-medium text-brand-700 dark:text-brand-300">
              <Sparkles className="h-3.5 w-3.5" />
              Tracking 500+ AI models in real time
            </span>
            <h1 className="mt-6 text-balance text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
              Never miss an AI model update
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-pretty text-lg leading-relaxed text-foreground/70">
              Follow the models you use. Get notified the moment they change.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/models"
                className="inline-flex h-11 items-center gap-2 rounded-md bg-brand-600 px-5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-700"
              >
                Start following models
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <p className="mt-6 text-sm text-muted">
              Join 4,200+ developers tracking 500+ AI models
            </p>
          </div>
        </div>
      </section>

      {/* Trending Models */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Trending models this week
            </h2>
            <p className="mt-1 text-sm text-muted">
              The models developers are following right now.
            </p>
          </div>
          <Link
            href="/models"
            className="hidden shrink-0 items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700 sm:inline-flex"
          >
            View all models
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {trending.length === 0 ? (
          <div className="mt-8 rounded-xl border border-dashed border-border bg-surface-muted p-10 text-center text-sm text-muted">
            No trending models yet. Seed the database to populate this section.
          </div>
        ) : (
          <div className="-mx-4 mt-6 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0 [scrollbar-width:thin]">
            {trending.map((m) => (
              <div
                key={m.id}
                className="w-72 shrink-0 snap-start sm:w-80"
              >
                <ModelCard
                  modelId={m.id}
                  slug={m.slug}
                  name={m.name}
                  maker={m.maker}
                  category={m.category}
                  followerCount={m.follower_count}
                  lastUpdatedAt={m.last_updated_at}
                  isAuthenticated={Boolean(user)}
                  initialFollowing={followedModelIds.has(m.id)}
                />
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 sm:hidden">
          <Link
            href="/models"
            className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            View all models
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Latest Updates */}
      <div className="border-y border-border bg-surface-muted/40">
        <ArticlesFeed articles={feedArticles} />
      </div>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            How it works
          </h2>
          <p className="mt-2 text-sm text-muted">
            Three steps between you and your first notification.
          </p>
        </div>

        <ol className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
          {[
            {
              icon: Plus,
              title: 'Follow models',
              body: 'Pick the LLMs, image, audio, or code models you care about — or follow an entire category.',
            },
            {
              icon: Cpu,
              title: 'We track everything',
              body: 'Our pipeline watches official blogs, changelogs, and APIs 24/7 and summarises every change.',
            },
            {
              icon: Bell,
              title: 'You get notified',
              body: 'Push, email, or WhatsApp — pick your channel and frequency. Breaking news reaches you instantly.',
            },
          ].map((step, i) => (
            <li
              key={step.title}
              className="relative rounded-xl border border-border bg-surface p-6"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600/10 text-brand-600">
                  <step.icon className="h-5 w-5" />
                </span>
                <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Step {i + 1}
                </span>
              </div>
              <h3 className="mt-4 text-lg font-semibold tracking-tight">
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-foreground/70">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {/* Categories grid */}
      <section className="border-t border-border bg-surface-muted/40">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Browse by category
              </h2>
              <p className="mt-1 text-sm text-muted">
                Follow an entire category in one click.
              </p>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-3">
            {CATEGORY_ORDER.map((cat) => {
              const meta = CATEGORY_META[cat]
              const Icon = meta.icon
              const count = categoryCounts[cat] ?? 0
              return (
                <Link
                  key={cat}
                  href={`/categories/${cat}`}
                  className="group flex items-center gap-4 rounded-xl border border-border bg-surface p-5 transition-colors hover:border-brand-500/40"
                >
                  <span
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${meta.tint}`}
                  >
                    <Icon className="h-6 w-6" />
                  </span>
                  <div className="min-w-0">
                    <div className="font-semibold tracking-tight group-hover:text-brand-600">
                      {meta.label}
                    </div>
                    <div className="text-xs text-muted">
                      {count} {count === 1 ? 'model' : 'models'}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </section>
    </>
  )
}
