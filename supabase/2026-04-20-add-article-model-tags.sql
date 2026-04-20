-- PulseAI — add model_tags to articles for display-time model names.
-- Safe to re-run.

alter table public.articles
  add column if not exists model_tags text[] not null default '{}';

create index if not exists articles_model_tags_gin_idx
  on public.articles using gin (model_tags);
