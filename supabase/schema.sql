-- PulseAI — Supabase schema
-- Run in the Supabase SQL editor. Safe to re-run: uses IF NOT EXISTS / CREATE OR REPLACE where possible.

-- =========================================================================
-- Extensions
-- =========================================================================
create extension if not exists "pgcrypto";

-- =========================================================================
-- Enums
-- =========================================================================
do $$ begin
  create type model_category as enum ('llm', 'image', 'code', 'audio', 'multimodal', 'infrastructure');
exception when duplicate_object then null; end $$;

do $$ begin
  create type article_importance as enum ('breaking', 'major', 'minor');
exception when duplicate_object then null; end $$;

do $$ begin
  create type notification_frequency as enum ('instant', 'daily', 'weekly');
exception when duplicate_object then null; end $$;

do $$ begin
  create type notification_channel as enum ('email', 'push', 'whatsapp');
exception when duplicate_object then null; end $$;

do $$ begin
  create type notification_status as enum ('sent', 'failed');
exception when duplicate_object then null; end $$;

-- =========================================================================
-- models
-- =========================================================================
create table if not exists public.models (
  id                       uuid primary key default gen_random_uuid(),
  name                     text not null,
  slug                     text not null unique,
  maker                    text,
  category                 model_category not null,
  description              text,
  logo_url                 text,
  current_version          text,
  pricing_input_per_1m     numeric(12,4),
  pricing_output_per_1m    numeric(12,4),
  context_window           integer,
  release_date             date,
  last_updated_at          timestamptz,
  follower_count           integer not null default 0,
  is_active                boolean not null default true,
  created_at               timestamptz not null default now()
);

-- =========================================================================
-- articles
-- =========================================================================
create table if not exists public.articles (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  slug           text not null unique,
  summary        text,
  body           text,
  model_ids      uuid[] not null default '{}',
  category       text,
  importance     article_importance not null default 'minor',
  source_url     text,
  source_name    text,
  published_at   timestamptz,
  is_published   boolean not null default false,
  ai_generated   boolean not null default true,
  created_at     timestamptz not null default now()
);

-- =========================================================================
-- users (profile rows — 1:1 with auth.users)
-- =========================================================================
create table if not exists public.users (
  id                      uuid primary key references auth.users(id) on delete cascade,
  email                   text not null,
  whatsapp_number         text,
  notification_frequency  notification_frequency not null default 'instant',
  push_enabled            boolean not null default true,
  whatsapp_enabled        boolean not null default false,
  created_at              timestamptz not null default now()
);

-- =========================================================================
-- follows
-- =========================================================================
create table if not exists public.follows (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  model_id   uuid references public.models(id) on delete cascade,
  category   text,
  created_at timestamptz not null default now(),
  constraint follows_target_chk check (
    (model_id is not null and category is null) or
    (model_id is null and category is not null)
  ),
  constraint follows_user_model_unique unique (user_id, model_id),
  constraint follows_user_category_unique unique (user_id, category)
);

-- =========================================================================
-- notification_log
-- =========================================================================
create table if not exists public.notification_log (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  article_id uuid not null references public.articles(id) on delete cascade,
  channel    notification_channel not null,
  sent_at    timestamptz not null default now(),
  status     notification_status not null
);

-- =========================================================================
-- processed_items (dedup for the ingest pipeline)
-- =========================================================================
create table if not exists public.processed_items (
  id           uuid primary key default gen_random_uuid(),
  source_hash  text not null unique,
  source_url   text,
  processed_at timestamptz not null default now()
);

-- =========================================================================
-- Indexes
-- =========================================================================
create index if not exists articles_published_at_idx  on public.articles (published_at desc);
create index if not exists articles_model_ids_gin_idx on public.articles using gin (model_ids);
create index if not exists models_slug_idx            on public.models (slug);
create index if not exists follows_user_id_idx        on public.follows (user_id);

-- =========================================================================
-- Follower-count trigger
-- =========================================================================
create or replace function public.sync_model_follower_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.model_id is not null then
      update public.models
         set follower_count = follower_count + 1
       where id = new.model_id;
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    if old.model_id is not null then
      update public.models
         set follower_count = greatest(follower_count - 1, 0)
       where id = old.model_id;
    end if;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists follows_follower_count_ins on public.follows;
create trigger follows_follower_count_ins
after insert on public.follows
for each row execute function public.sync_model_follower_count();

drop trigger if exists follows_follower_count_del on public.follows;
create trigger follows_follower_count_del
after delete on public.follows
for each row execute function public.sync_model_follower_count();

-- =========================================================================
-- Row Level Security
-- =========================================================================
alter table public.models            enable row level security;
alter table public.articles          enable row level security;
alter table public.users             enable row level security;
alter table public.follows           enable row level security;
alter table public.notification_log  enable row level security;
alter table public.processed_items   enable row level security;

-- models: public read
drop policy if exists "models_public_read" on public.models;
create policy "models_public_read"
on public.models for select
to anon, authenticated
using (true);

-- articles: public read only when published
drop policy if exists "articles_public_read" on public.articles;
create policy "articles_public_read"
on public.articles for select
to anon, authenticated
using (is_published = true);

-- users: owner-only read/write
drop policy if exists "users_select_own" on public.users;
create policy "users_select_own"
on public.users for select
to authenticated
using (auth.uid() = id);

drop policy if exists "users_insert_own" on public.users;
create policy "users_insert_own"
on public.users for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "users_update_own" on public.users;
create policy "users_update_own"
on public.users for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "users_delete_own" on public.users;
create policy "users_delete_own"
on public.users for delete
to authenticated
using (auth.uid() = id);

-- follows: owner-only
drop policy if exists "follows_select_own" on public.follows;
create policy "follows_select_own"
on public.follows for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "follows_insert_own" on public.follows;
create policy "follows_insert_own"
on public.follows for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "follows_update_own" on public.follows;
create policy "follows_update_own"
on public.follows for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "follows_delete_own" on public.follows;
create policy "follows_delete_own"
on public.follows for delete
to authenticated
using (auth.uid() = user_id);

-- notification_log: owner-only read/write
-- (service-role writes bypass RLS, so the ingest/notifier pipeline is unaffected)
drop policy if exists "notif_log_select_own" on public.notification_log;
create policy "notif_log_select_own"
on public.notification_log for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "notif_log_insert_own" on public.notification_log;
create policy "notif_log_insert_own"
on public.notification_log for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "notif_log_update_own" on public.notification_log;
create policy "notif_log_update_own"
on public.notification_log for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "notif_log_delete_own" on public.notification_log;
create policy "notif_log_delete_own"
on public.notification_log for delete
to authenticated
using (auth.uid() = user_id);

-- processed_items: no client access; service role bypasses RLS.
-- (RLS is enabled with no policies, which denies all client reads/writes.)
