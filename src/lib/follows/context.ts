import { createClient } from '@/lib/supabase/server'
import type { User } from '@supabase/supabase-js'

export type FollowContext = {
  user: User | null
  followedModelIds: Set<string>
  followedCategories: Set<string>
}

// One-shot server helper: who's signed in, and which of these models /
// categories do they already follow? Call once per page render before
// rendering any ModelCard or CategoryFollowButton.
export async function getFollowContext({
  modelIds = [],
  categories = [],
}: {
  modelIds?: string[]
  categories?: string[]
} = {}): Promise<FollowContext> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      user: null,
      followedModelIds: new Set(),
      followedCategories: new Set(),
    }
  }

  const followedModelIds = new Set<string>()
  const followedCategories = new Set<string>()

  if (modelIds.length > 0 || categories.length > 0) {
    const clauses: string[] = []
    if (modelIds.length > 0) {
      clauses.push(`model_id.in.(${modelIds.map((id) => `"${id}"`).join(',')})`)
    }
    if (categories.length > 0) {
      clauses.push(
        `category.in.(${categories.map((c) => `"${c}"`).join(',')})`
      )
    }
    const { data } = await supabase
      .from('follows')
      .select('model_id, category')
      .eq('user_id', user.id)
      .or(clauses.join(','))
    for (const row of data ?? []) {
      const mid = row.model_id as string | null
      const cat = row.category as string | null
      if (mid) followedModelIds.add(mid)
      if (cat) followedCategories.add(cat)
    }
  }

  return { user, followedModelIds, followedCategories }
}
