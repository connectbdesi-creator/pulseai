-- PulseAI — article_comments table
-- Run in the Supabase SQL editor. Safe to re-run.

create table if not exists public.article_comments (
  id         uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  parent_id  uuid references public.article_comments(id) on delete cascade,
  body       text not null check (length(trim(body)) between 1 and 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  is_deleted boolean not null default false
);

create index if not exists article_comments_article_created_idx
  on public.article_comments (article_id, created_at);

create index if not exists article_comments_parent_idx
  on public.article_comments (parent_id);

-- RLS
alter table public.article_comments enable row level security;

-- Anyone can read non-deleted comments.
drop policy if exists "comments_public_read" on public.article_comments;
create policy "comments_public_read"
on public.article_comments for select
to anon, authenticated
using (is_deleted = false);

-- Authenticated users can post their own comments.
drop policy if exists "comments_insert_own" on public.article_comments;
create policy "comments_insert_own"
on public.article_comments for insert
to authenticated
with check (auth.uid() = user_id);

-- Users can edit their own comments.
drop policy if exists "comments_update_own" on public.article_comments;
create policy "comments_update_own"
on public.article_comments for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Hard-delete their own comments.
drop policy if exists "comments_delete_own" on public.article_comments;
create policy "comments_delete_own"
on public.article_comments for delete
to authenticated
using (auth.uid() = user_id);
