'use server'

import { revalidatePath } from 'next/cache'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import type {
  ArticleImportance,
  ModelCategory,
} from '@/types/database'

const VALID_CATEGORIES: ModelCategory[] = [
  'llm',
  'image',
  'code',
  'audio',
  'multimodal',
  'infrastructure',
]

const VALID_IMPORTANCE: ArticleImportance[] = ['breaking', 'major', 'minor']

// --- Auth guard -------------------------------------------------------
// Every action calls this first. Anon callers and signed-in non-admins get
// rejected before touching any data.
async function requireAdmin(): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const adminEmail = process.env.ADMIN_EMAIL
  if (!adminEmail) throw new Error('ADMIN_EMAIL not configured')
  if (!user || user.email !== adminEmail) {
    throw new Error('Not authorized')
  }
}

// Service-role client — bypasses RLS. Only used after requireAdmin passes.
function service() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase credentials')
  return createServiceClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function triggerNotify(articleId: string): Promise<void> {
  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  ).replace(/\/$/, '')
  const secret = process.env.NOTIFY_SECRET
  if (!secret) return
  try {
    await fetch(`${siteUrl}/api/notify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-notify-secret': secret,
      },
      body: JSON.stringify({ articleId }),
    })
  } catch {
    // best-effort — notification failure must not block the approve action
  }
}

// --- Actions ----------------------------------------------------------

type Result = { error: string | null }

export async function approveArticle(id: string): Promise<Result> {
  await requireAdmin()
  if (!id) return { error: 'Missing article id' }

  const { data, error } = await service()
    .from('articles')
    .update({
      is_published: true,
      published_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('id, importance')
    .single()

  if (error) return { error: error.message }

  if (
    data?.importance === 'breaking' ||
    data?.importance === 'major'
  ) {
    await triggerNotify(id)
  }

  revalidatePath('/admin')
  return { error: null }
}

export async function deleteArticle(id: string): Promise<Result> {
  await requireAdmin()
  if (!id) return { error: 'Missing article id' }
  const { error } = await service().from('articles').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin')
  return { error: null }
}

export type ArticleUpdateInput = {
  title?: string
  summary?: string | null
  body?: string | null
  importance?: ArticleImportance
}

export async function updateArticle(
  id: string,
  data: ArticleUpdateInput
): Promise<Result> {
  await requireAdmin()
  if (!id) return { error: 'Missing article id' }

  const patch: Record<string, unknown> = {}
  if (typeof data.title === 'string') {
    const t = data.title.trim()
    if (!t) return { error: 'Title cannot be empty' }
    patch.title = t
  }
  if (data.summary !== undefined) patch.summary = data.summary
  if (data.body !== undefined) patch.body = data.body
  if (data.importance) {
    if (!VALID_IMPORTANCE.includes(data.importance)) {
      return { error: 'Invalid importance' }
    }
    patch.importance = data.importance
  }
  if (Object.keys(patch).length === 0) {
    return { error: 'No fields to update' }
  }

  const { error } = await service().from('articles').update(patch).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin')
  return { error: null }
}

export async function toggleModel(
  id: string,
  isActive: boolean
): Promise<Result> {
  await requireAdmin()
  if (!id) return { error: 'Missing model id' }
  const { error } = await service()
    .from('models')
    .update({ is_active: isActive })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin')
  return { error: null }
}

export type CreateModelInput = {
  name: string
  slug: string
  maker: string | null
  category: ModelCategory
  description: string | null
  current_version: string | null
  pricing_input_per_1m: number | null
  pricing_output_per_1m: number | null
  context_window: number | null
  release_date: string | null
  logo_url: string | null
}

export async function createModel(input: CreateModelInput): Promise<Result> {
  await requireAdmin()

  const name = input.name?.trim()
  const slug = input.slug?.trim().toLowerCase()
  if (!name) return { error: 'Name is required' }
  if (!slug || !/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
    return { error: 'Slug must be kebab-case (a-z, 0-9, hyphens)' }
  }
  if (!VALID_CATEGORIES.includes(input.category)) {
    return { error: 'Invalid category' }
  }

  const { error } = await service()
    .from('models')
    .insert({
      name,
      slug,
      maker: input.maker?.trim() || null,
      category: input.category,
      description: input.description?.trim() || null,
      current_version: input.current_version?.trim() || null,
      pricing_input_per_1m: input.pricing_input_per_1m,
      pricing_output_per_1m: input.pricing_output_per_1m,
      context_window: input.context_window,
      release_date: input.release_date || null,
      logo_url: input.logo_url?.trim() || null,
    })

  if (error) {
    if ((error as { code?: string }).code === '23505') {
      return { error: 'A model with that slug already exists' }
    }
    return { error: error.message }
  }

  revalidatePath('/admin')
  return { error: null }
}
