import Link from 'next/link'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { ArrowRight, Mail } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Tabs, type TabSpec } from '@/components/ui/Tabs'
import { ArticleCard } from '@/components/ui/ArticleCard'
import { ModelCard } from '@/components/ui/ModelCard'
import { SettingsForm } from './SettingsForm'
import { CategoryPill } from './CategoryPill'
import { SignOutForm } from './SignOutForm'
import type {
  ArticleRow,
  ModelCategory,
  ModelRow,
  NotificationFrequency,
} from '@/types/database'

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Your personalised AI model update feed.',
}

const CATEGORY_LABEL: Record<ModelCategory, string> = {
  llm: 'LLMs',
  image: 'Image',
  code: 'Code',
  audio: 'Audio',
  multimodal: 'Multimodal',
  infrastructure: 'Infrastructure',
}

type FollowedModel = Pick<
  ModelRow,
  | 'id'
  | 'slug'
  | 'name'
  | 'maker'
  | 'category'
  | 'follower_count'
  | 'last_updated_at'
>

type FeedArticle = Pick<
  ArticleRow,
  | 'id'
  | 'slug'
  | 'title'
  | 'summary'
  | 'importance'
  | 'published_at'
  | 'source_name'
  | 'model_ids'
  | 'model_tags'
>

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // The proxy should have redirected already, but guard anyway.
  if (!user) redirect('/login?redirect=/dashboard')

  // 1. Profile row — upsert-on-missing so the page works even if the
  //    auth.users trigger wasn't installed at signup time.
  let profile: {
    notification_frequency: NotificationFrequency
    push_enabled: boolean
    whatsapp_enabled: boolean
    whatsapp_number: string | null
  } | null = null

  const { data: profileRow } = await supabase
    .from('users')
    .select(
      'notification_frequency, push_enabled, whatsapp_enabled, whatsapp_number'
    )
    .eq('id', user.id)
    .maybeSingle()

  if (profileRow) {
    profile = profileRow
  } else {
    const { data: inserted } = await supabase
      .from('users')
      .insert({ id: user.id, email: user.email ?? '' })
      .select(
        'notification_frequency, push_enabled, whatsapp_enabled, whatsapp_number'
      )
      .maybeSingle()
    profile = inserted ?? {
      notification_frequency: 'instant',
      push_enabled: true,
      whatsapp_enabled: false,
      whatsapp_number: null,
    }
  }

  // 2. User's follows — split into model ids and categories.
  const { data: followRows } = await supabase
    .from('follows')
    .select('model_id, category, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const followedModelIds = (followRows ?? [])
    .map((r) => r.model_id as string | null)
    .filter((id): id is string => Boolean(id))

  const followedCategories = (followRows ?? [])
    .map((r) => r.category as string | null)
    .filter((c): c is string => Boolean(c))

  // 3. Followed model details (for the Following tab grid).
  let followedModels: FollowedModel[] = []
  if (followedModelIds.length > 0) {
    const { data } = await supabase
      .from('models')
      .select(
        'id, slug, name, maker, category, follower_count, last_updated_at'
      )
      .in('id', followedModelIds)
    followedModels = (data ?? []) as FollowedModel[]
  }

  // 4. Personalised feed — articles overlapping with followed models OR
  //    matching a followed category. Short-circuit if nothing is followed.
  let feed: FeedArticle[] = []
  if (followedModelIds.length > 0 || followedCategories.length > 0) {
    const orClauses: string[] = []
    if (followedModelIds.length > 0) {
      orClauses.push(`model_ids.ov.{${followedModelIds.join(',')}}`)
    }
    if (followedCategories.length > 0) {
      // Quote categories for safety — they're enum-ish strings but this keeps
      // the filter resilient to future free-form values.
      const quoted = followedCategories
        .map((c) => `"${c.replace(/"/g, '')}"`)
        .join(',')
      orClauses.push(`category.in.(${quoted})`)
    }
    const { data, error } = await supabase
      .from('articles')
      .select(
        'id, slug, title, summary, importance, published_at, source_name, model_ids, model_tags'
      )
      .eq('is_published', true)
      .or(orClauses.join(','))
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(50)
    if (error) throw error
    feed = (data ?? []) as FeedArticle[]
  }

  // Name map for article cards.
  const { data: nameRows } = await supabase.from('models').select('id, name')
  const modelNameById = new Map<string, string>(
    (nameRows ?? []).map((m) => [m.id as string, m.name as string])
  )

  // --- Tabs content -----------------------------------------------------

  const feedTab: TabSpec = {
    id: 'feed',
    label: 'My Feed',
    count: feed.length,
    content:
      feed.length === 0 ? (
        <EmptyState
          title="You're not following anything yet"
          body="Follow models or categories to personalise your feed."
          cta={{ href: '/models', label: 'Browse models' }}
        />
      ) : (
        <ul className="flex flex-col gap-4">
          {feed.map((a) => (
            <li key={a.id}>
              <ArticleCard
                slug={a.slug}
                title={a.title}
                summary={a.summary}
                importance={a.importance}
                publishedAt={a.published_at}
                sourceName={a.source_name}
                modelNames={
                  a.model_tags && a.model_tags.length > 0
                    ? a.model_tags
                    : (a.model_ids ?? [])
                        .map((id) => modelNameById.get(id))
                        .filter((n): n is string => Boolean(n))
                }
              />
            </li>
          ))}
        </ul>
      ),
  }

  const followingTab: TabSpec = {
    id: 'following',
    label: 'Following',
    count: followedModels.length + followedCategories.length,
    content: (
      <div className="flex flex-col gap-10">
        <section>
          <h2 className="text-lg font-semibold tracking-tight">
            Followed models
          </h2>
          <p className="mt-1 text-sm text-muted">
            Click Following on any card to unfollow.
          </p>
          {followedModels.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-border bg-surface-muted p-8 text-center text-sm text-muted">
              You&apos;re not following any models yet.
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {followedModels.map((m) => (
                <ModelCard
                  key={m.id}
                  modelId={m.id}
                  slug={m.slug}
                  name={m.name}
                  maker={m.maker}
                  category={m.category}
                  followerCount={m.follower_count}
                  lastUpdatedAt={m.last_updated_at}
                  isAuthenticated
                  initialFollowing
                />
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-lg font-semibold tracking-tight">
            Followed categories
          </h2>
          {followedCategories.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-border bg-surface-muted p-8 text-center text-sm text-muted">
              No categories followed.
            </div>
          ) : (
            <div className="mt-4 flex flex-wrap gap-2">
              {followedCategories.map((c) => (
                <CategoryPill
                  key={c}
                  category={c}
                  label={CATEGORY_LABEL[c as ModelCategory] ?? c}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    ),
  }

  const settingsTab: TabSpec = {
    id: 'settings',
    label: 'Notifications',
    content: (
      <SettingsForm
        initial={{
          notification_frequency: profile.notification_frequency,
          push_enabled: profile.push_enabled,
          whatsapp_enabled: profile.whatsapp_enabled,
          whatsapp_number: profile.whatsapp_number,
        }}
      />
    ),
  }

  const accountTab: TabSpec = {
    id: 'account',
    label: 'Account',
    content: (
      <div className="flex flex-col gap-6">
        <div className="rounded-xl border border-border bg-surface p-6">
          <h2 className="text-sm font-semibold">Email</h2>
          <div className="mt-2 flex items-center gap-2 text-sm text-foreground/80">
            <Mail className="h-4 w-4 text-muted" />
            <span>{user.email}</span>
          </div>
          <p className="mt-2 text-xs text-muted">
            Magic-link sign-in uses this address. Changing it will be supported
            in a future update.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-surface p-6">
          <h2 className="text-sm font-semibold">Session</h2>
          <p className="mt-2 text-xs text-muted">
            Sign out to end your session on this device. All other devices stay
            signed in.
          </p>
          <div className="mt-4">
            <SignOutForm />
          </div>
        </div>
      </div>
    ),
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8 flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Dashboard
        </h1>
        <p className="text-sm text-muted">
          Your personalised feed and notification settings.
        </p>
      </header>

      <Tabs
        ariaLabel="Dashboard sections"
        tabs={[feedTab, followingTab, settingsTab, accountTab]}
      />
    </div>
  )
}

function EmptyState({
  title,
  body,
  cta,
}: {
  title: string
  body: string
  cta: { href: string; label: string }
}) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-surface-muted p-10 text-center">
      <h3 className="text-base font-semibold tracking-tight">{title}</h3>
      <p className="mt-1 text-sm text-muted">{body}</p>
      <Link
        href={cta.href}
        className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700"
      >
        {cta.label}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  )
}
