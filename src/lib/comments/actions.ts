'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type CommentInput = {
  articleSlug: string
  articleId: string
  body: string
  parentId?: string | null
}

type Result = { error: string | null; commentId?: string }

const MAX_LEN = 4000

export async function createComment(input: CommentInput): Promise<Result> {
  const body = (input.body ?? '').trim()
  if (!body) return { error: 'Comment cannot be empty' }
  if (body.length > MAX_LEN) {
    return { error: `Comment too long (max ${MAX_LEN} characters)` }
  }
  if (!input.articleId) return { error: 'Missing article' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Sign in to comment' }

  const { data, error } = await supabase
    .from('article_comments')
    .insert({
      article_id: input.articleId,
      user_id: user.id,
      parent_id: input.parentId ?? null,
      body,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  revalidatePath(`/updates/${input.articleSlug}`)
  return { error: null, commentId: data?.id as string }
}

export async function deleteComment(
  commentId: string,
  articleSlug: string
): Promise<Result> {
  if (!commentId) return { error: 'Missing comment id' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Sign in to delete' }

  // RLS enforces auth.uid() = user_id on delete, so non-authors get
  // a silent 0-row delete. We check the result and surface a clean error.
  const { error, count } = await supabase
    .from('article_comments')
    .delete({ count: 'exact' })
    .eq('id', commentId)

  if (error) return { error: error.message }
  if (!count || count === 0) {
    return { error: 'You can only delete your own comments.' }
  }

  revalidatePath(`/updates/${articleSlug}`)
  return { error: null }
}
