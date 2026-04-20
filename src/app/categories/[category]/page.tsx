import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import {
  ArrowLeft,
  Code,
  Image as ImageIcon,
  Layers,
  MessageSquare,
  Music,
  Server,
} from 'lucide-react'
import { createPublicClient } from '@/lib/supabase/public'
import { createClient } from '@/lib/supabase/server'
import { ModelCard } from '@/components/ui/ModelCard'
import { CategoryFollowButton } from '@/components/follow/CategoryFollowButton'
import type { ModelCategory, ModelRow } from '@/types/database'

const CATEGORY_META: Record<
  ModelCategory,
  {
    label: string
    description: string
    icon: typeof MessageSquare
    tint: string
  }
> = {
  llm: {
    label: 'LLMs',
    description:
      'Text-in, text-out models for chat, reasoning, summarisation, and tool use.',
    icon: MessageSquare,
    tint: 'bg-violet-500/10 text-violet-600 dark:text-violet-300',
  },
  image: {
    label: 'Image',
    description: 'Text-to-image generators and editors.',
    icon: ImageIcon,
    tint: 'bg-pink-500/10 text-pink-600 dark:text-pink-300',
  },
  code: {
    label: 'Code',
    description: 'Coding copilots, agents, and competitive-programming systems.',
    icon: Code,
    tint: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
  },
  audio: {
    label: 'Audio',
    description: 'Speech-to-text, text-to-speech, and music generation.',
    icon: Music,
    tint: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  },
  multimodal: {
    label: 'Multimodal',
    description:
      'Models that natively handle text, images, audio, and video together.',
    icon: Layers,
    tint: 'bg-sky-500/10 text-sky-600 dark:text-sky-300',
  },
  infrastructure: {
    label: 'Infrastructure',
    description:
      'Inference platforms, vector stores, and the plumbing underneath AI apps.',
    icon: Server,
    tint: 'bg-slate-500/10 text-slate-700 dark:text-slate-300',
  },
}

const VALID_CATEGORIES = Object.keys(CATEGORY_META) as ModelCategory[]

export async function generateStaticParams() {
  return VALID_CATEGORIES.map((category) => ({ category }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>
}): Promise<Metadata> {
  const { category } = await params
  if (!VALID_CATEGORIES.includes(category as ModelCategory)) {
    return { title: { absolute: 'Category not found — PulseAI' } }
  }
  const meta = CATEGORY_META[category as ModelCategory]
  return {
    title: { absolute: `${meta.label} — PulseAI` },
    description: meta.description,
    alternates: { canonical: `/categories/${category}` },
  }
}

export default async function CategoryDetailPage({
  params,
}: {
  params: Promise<{ category: string }>
}) {
  const { category } = await params
  if (!VALID_CATEGORIES.includes(category as ModelCategory)) notFound()

  const cat = category as ModelCategory
  const meta = CATEGORY_META[cat]
  const Icon = meta.icon

  const supabase = createPublicClient()

  const [modelsRes, countRes] = await Promise.all([
    supabase
      .from('models')
      .select(
        'id, slug, name, maker, category, follower_count, last_updated_at'
      )
      .eq('is_active', true)
      .eq('category', cat)
      .order('follower_count', { ascending: false }),
    supabase
      .from('follows')
      .select('id', { count: 'exact', head: true })
      .eq('category', cat),
  ])

  if (modelsRes.error) throw modelsRes.error

  const models = (modelsRes.data ?? []) as Pick<
    ModelRow,
    | 'id'
    | 'slug'
    | 'name'
    | 'maker'
    | 'category'
    | 'follower_count'
    | 'last_updated_at'
  >[]
  const followerCount = countRes.count ?? 0

  // Auth + follow state for the current user.
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
      .eq('category', cat)
    isFollowing = (count ?? 0) > 0
  }

  return (
    <>
      <div className="mx-auto max-w-5xl px-4 pt-8 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Home
        </Link>
      </div>

      <section className="mx-auto max-w-5xl px-4 pt-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div
              className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-xl ${meta.tint}`}
              aria-hidden
            >
              <Icon className="h-8 w-8" />
            </div>
            <div className="min-w-0">
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                {meta.label}
              </h1>
              <p className="mt-2 max-w-xl text-sm text-muted">
                {meta.description}
              </p>
              <p className="mt-2 text-xs text-muted">
                {models.length} {models.length === 1 ? 'model' : 'models'}
              </p>
            </div>
          </div>

          <div className="sm:shrink-0">
            <CategoryFollowButton
              category={cat}
              categoryLabel={meta.label}
              initialIsFollowing={isFollowing}
              initialCount={followerCount}
              isAuthenticated={Boolean(user)}
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        {models.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-surface-muted p-10 text-center text-sm text-muted">
            No {meta.label} models yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {models.map((m) => (
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
        )}
      </section>
    </>
  )
}
