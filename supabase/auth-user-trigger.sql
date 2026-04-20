-- PulseAI — auth.users → public.users sync trigger
-- Run once in the Supabase SQL editor AFTER schema.sql has been applied.
-- Safe to re-run.

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email)
  values (new.id, coalesce(new.email, ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Fire once per row inserted into auth.users. This runs with the function
-- owner's privileges (security definer) so the trigger can write to
-- public.users even though the signup itself is performed as the `supabase_auth_admin`
-- role, which has no direct grant on public.users.
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();
