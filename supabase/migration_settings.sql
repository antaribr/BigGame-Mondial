-- ============================================================================
-- MIGRATION: leaderboard visibility + lock member edits
-- Run this in Supabase → SQL Editor → New query → Run.
-- Safe to run more than once. (You only need this if you already ran the
-- original schema.sql — the main schema.sql now includes these changes too.)
-- ============================================================================

-- 1) Settings table (single row) — controls whether teams can see the
-- public leaderboard / other teams' points.
create table if not exists public.settings (
  id int primary key default 1,
  leaderboard_public boolean not null default true,
  constraint singleton check (id = 1)
);

insert into public.settings (id, leaderboard_public) values (1, true)
on conflict (id) do nothing;

alter table public.settings enable row level security;

drop policy if exists "read settings" on public.settings;
create policy "read settings" on public.settings for select using (true);

-- 2) Lock members: teams/anon can NO LONGER delete members.
-- Only the admin (service-role key, which bypasses RLS) can add/remove.
drop policy if exists "delete members" on public.members;

-- 3) Realtime so the team screens react instantly when the admin toggles.
do $$
begin
  begin alter publication supabase_realtime add table public.settings;
  exception when others then null; end;
end $$;
