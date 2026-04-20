'use server'

import { createClient } from '@/lib/supabase/server'
import type { FollowRow, ModelCategory } from '@/types/database'

type ActionResult = { error: string | null }

const VALID_CATEGORIES: ModelCategory[] = [
  'llm',
  'image',
  'code',
  'audio',
  'multimodal',
  'infrastructure',
]

// Postgres unique_violation — a duplicate follow attempt is treated as success
// (idempotent). Any other error bubbles up.
const UNIQUE_VIOLATION = '23505'

export async function followModel(modelId: string): Promise<ActionResult> {
  if (!modelId) return { error: 'Missing model id' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('follows')
    .insert({ user_id: user.id, model_id: modelId })

  if (error && error.code !== UNIQUE_VIOLATION) {
    return { error: error.message }
  }
  return { error: null }
}

export async function unfollowModel(modelId: string): Promise<ActionResult> {
  if (!modelId) return { error: 'Missing model id' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('user_id', user.id)
    .eq('model_id', modelId)

  if (error) return { error: error.message }
  return { error: null }
}

export async function followCategory(
  category: string
): Promise<ActionResult> {
  if (!VALID_CATEGORIES.includes(category as ModelCategory)) {
    return { error: 'Invalid category' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('follows')
    .insert({ user_id: user.id, category })

  if (error && error.code !== UNIQUE_VIOLATION) {
    return { error: error.message }
  }
  return { error: null }
}

export async function unfollowCategory(
  category: string
): Promise<ActionResult> {
  if (!category) return { error: 'Missing category' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('user_id', user.id)
    .eq('category', category)

  if (error) return { error: error.message }
  return { error: null }
}

export async function getUserFollows(
  userId: string
): Promise<{ follows: FollowRow[]; error: string | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  // Belt and braces — RLS already enforces this, but fail fast for clarity.
  if (!user || user.id !== userId) {
    return { follows: [], error: 'Not authorized' }
  }

  const { data, error } = await supabase
    .from('follows')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) return { follows: [], error: error.message }
  return { follows: (data ?? []) as FollowRow[], error: null }
}

export async function isFollowing(
  userId: string,
  modelId?: string
): Promise<boolean> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.id !== userId) return false

  let query = supabase
    .from('follows')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)

  if (modelId) query = query.eq('model_id', modelId)

  const { count } = await query
  return (count ?? 0) > 0
}

export async function isFollowingCategory(
  userId: string,
  category: string
): Promise<boolean> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.id !== userId) return false

  const { count } = await supabase
    .from('follows')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('category', category)

  return (count ?? 0) > 0
}
