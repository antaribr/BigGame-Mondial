-- ============================================================================
--  THE BIG GAME — Supabase schema
--  Paste this whole file into: Supabase Dashboard → SQL Editor → New query → Run
--  It is safe to run more than once.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
--  Tables
-- ----------------------------------------------------------------------------

create table if not exists public.teams (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  code        text not null unique,            -- team join code, e.g. "FX7Q2"
  created_at  timestamptz not null default now()
);

create table if not exists public.members (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.teams(id) on delete cascade,
  name        text not null,
  created_at  timestamptz not null default now()
);

create table if not exists public.stations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  code        text not null unique,            -- advisor station code
  sort_order  int  not null default 0,
  max_score   int  not null default 10 check (max_score between 0 and 100),
  created_at  timestamptz not null default now()
);

create table if not exists public.completions (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.teams(id)    on delete cascade,
  station_id  uuid not null references public.stations(id) on delete cascade,
  score       int  not null check (score >= 0),
  created_at  timestamptz not null default now(),
  unique (team_id, station_id)                 -- one score per team/station
);

create table if not exists public.settings (
  id                 int  primary key default 1,
  leaderboard_public boolean not null default true,
  constraint singleton check (id = 1)
);

insert into public.settings (id, leaderboard_public) values (1, true)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
--  Indexes
-- ----------------------------------------------------------------------------
create index if not exists idx_members_team        on public.members(team_id);
create index if not exists idx_completions_team    on public.completions(team_id);
create index if not exists idx_completions_station on public.completions(station_id);

-- ----------------------------------------------------------------------------
--  Leaderboard view (ranked, computed live)
-- ----------------------------------------------------------------------------
create or replace view public.leaderboard as
select
  t.id   as team_id,
  t.name as team_name,
  t.code as team_code,
  count(distinct c.station_id)::int              as tasks_completed,
  coalesce(sum(c.score), 0)::int                 as total_points,
  (rank() over (
      order by coalesce(sum(c.score), 0) desc,
               count(distinct c.station_id) desc,
               t.name asc
  ))::int                                        as rank
from public.teams t
left join public.completions c on c.team_id = t.id
group by t.id, t.name, t.code;

grant select on public.leaderboard to anon, authenticated;

-- ----------------------------------------------------------------------------
--  Row Level Security
--  The browser uses the anonymous key, so:
--   • reads are public  (public leaderboard)
--   • teams/members are insertable by anyone (registration)
--   • completions + stations have NO anon write — points come only through
--     the security-definer RPCs below (checked by station code),
--     and stations are managed only via the admin service-role key.
-- ----------------------------------------------------------------------------
alter table public.teams       enable row level security;
alter table public.members     enable row level security;
alter table public.stations    enable row level security;
alter table public.completions enable row level security;

drop policy if exists "read teams"       on public.teams;
create policy "read teams"       on public.teams       for select using (true);
drop policy if exists "read members"     on public.members;
create policy "read members"     on public.members     for select using (true);
drop policy if exists "read stations"    on public.stations;
create policy "read stations"    on public.stations    for select using (true);
drop policy if exists "read completions" on public.completions;
create policy "read completions" on public.completions for select using (true);

drop policy if exists "insert teams"   on public.teams;
create policy "insert teams"   on public.teams   for insert with check (true);
drop policy if exists "insert members" on public.members;
create policy "insert members" on public.members for insert with check (true);
-- NOTE: members can no longer be deleted by teams/anon — only via the admin
-- (service-role key), which bypasses RLS.

drop policy if exists "read settings" on public.settings;
create policy "read settings" on public.settings for select using (true);

-- ----------------------------------------------------------------------------
--  RPC: award / update a team's score for a station  (advisor only)
--  Validates the station code, so a team cannot fake its own points.
-- ----------------------------------------------------------------------------
create or replace function public.complete_task(
  p_station_code text,
  p_team_id      uuid,
  p_score        int
) returns public.completions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_station public.stations;
  v_result  public.completions;
begin
  select * into v_station from public.stations where code = upper(p_station_code);
  if not found then
    raise exception 'Invalid station code';
  end if;

  if p_score is null or p_score < 0 or p_score > v_station.max_score then
    raise exception 'Score % is not allowed for this station (allowed: 0 to %)',
      p_score, v_station.max_score;
  end if;

  insert into public.completions (team_id, station_id, score)
  values (p_team_id, v_station.id, p_score)
  on conflict (team_id, station_id) do update
    set score = excluded.score
  returning * into v_result;

  return v_result;
end;
$$;

-- ----------------------------------------------------------------------------
--  RPC: undo a completion  (advisor only, must own the station)
-- ----------------------------------------------------------------------------
create or replace function public.undo_completion(
  p_station_code  text,
  p_completion_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
begin
  select c.id into v_row
  from public.completions c
  join public.stations s on s.id = c.station_id
  where c.id = p_completion_id and s.code = upper(p_station_code);

  if not found then
    raise exception 'Completion not found for this station';
  end if;

  delete from public.completions where id = p_completion_id;
end;
$$;

grant execute on function public.complete_task(text, uuid, int) to anon, authenticated;
grant execute on function public.undo_completion(text, uuid)      to anon, authenticated;

-- ----------------------------------------------------------------------------
--  Realtime — broadcast row changes so the UI updates live
-- ----------------------------------------------------------------------------
do $$
begin
  begin alter publication supabase_realtime add table public.teams;       exception when others then null; end;
  begin alter publication supabase_realtime add table public.members;     exception when others then null; end;
  begin alter publication supabase_realtime add table public.stations;    exception when others then null; end;
  begin alter publication supabase_realtime add table public.completions; exception when others then null; end;
end $$;

-- ----------------------------------------------------------------------------
--  (Optional) sample stations — uncomment to seed a few demo tasks
-- ----------------------------------------------------------------------------
-- insert into public.stations (name, description, code, sort_order) values
--   ('Brain Teaser', 'Solve the riddle in under 60 seconds.', 'TEASE', 1),
--   ('Team Relay',   'Finish the obstacle relay together.',   'RELAY', 2),
--   ('Trivia Tower', 'Answer 5 quiz questions correctly.',    'TRIVA', 3),
--   ('Photo Quest',  'Recreate the classic pose.',            'PHOTO', 4),
--   ('Speed Count',  'Count the objects fastest.',            'COUNT', 5)
-- on conflict (code) do nothing;
