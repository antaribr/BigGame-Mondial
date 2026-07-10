-- ============================================================================
-- BIGGAME — complete Supabase schema
-- Run this entire file in Supabase Dashboard > SQL Editor.
-- It is safe to run again when updating an existing BigGame database.
-- ============================================================================

create extension if not exists "pgcrypto";

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 40),
  code text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 40),
  created_at timestamptz not null default now()
);

create table if not exists public.stations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 60),
  description text,
  code text not null unique,
  sort_order integer not null default 0,
  max_score integer not null default 10 check (max_score between 0 and 100),
  created_at timestamptz not null default now()
);

create table if not exists public.completions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  station_id uuid not null references public.stations(id) on delete cascade,
  score numeric(8,2) not null check (score >= 0),
  created_at timestamptz not null default now(),
  unique (team_id, station_id)
);

create table if not exists public.settings (
  id integer primary key default 1,
  leaderboard_public boolean not null default true,
  constraint settings_singleton check (id = 1)
);

insert into public.settings (id, leaderboard_public)
values (1, true)
on conflict (id) do nothing;

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  option_a text not null,
  option_b text not null,
  option_c text not null,
  option_d text not null,
  correct_option text not null check (correct_option in ('A', 'B', 'C', 'D')),
  created_at timestamptz not null default now()
);

create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  station_id uuid not null references public.stations(id) on delete cascade,
  score numeric(8,2) not null default 0,
  questions_answered integer not null default 0,
  correct_answers integer not null default 0,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (team_id, station_id)
);

create table if not exists public.quiz_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.quiz_attempts(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  selected_option text check (selected_option is null or selected_option in ('A', 'B', 'C', 'D')),
  is_correct boolean not null default false,
  created_at timestamptz not null default now(),
  unique (attempt_id, question_id)
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 1 and 100),
  description text,
  max_score numeric(8,2) not null default 10 check (max_score between 0 and 1000),
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.task_submissions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'pending', 'approved', 'rejected')),
  score numeric(8,2) not null default 0 check (score >= 0),
  leader_note text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (task_id, team_id)
);

create table if not exists public.task_evidence (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.task_submissions(id) on delete cascade,
  storage_path text not null unique,
  original_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 5242880),
  created_at timestamptz not null default now()
);

-- Private evidence bucket. Upload and download access is granted only through
-- short-lived signed URLs created by the Vercel task API.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'task-evidence',
  'task-evidence',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Remove the view before normalizing score columns in an existing database.
drop view if exists public.leaderboard;
alter table public.completions alter column score type numeric(8,2) using score::numeric;
alter table public.quiz_attempts alter column score type numeric(8,2) using score::numeric;

create index if not exists idx_members_team on public.members(team_id);
create index if not exists idx_completions_team on public.completions(team_id);
create index if not exists idx_completions_station on public.completions(station_id);
create index if not exists idx_quiz_attempts_team on public.quiz_attempts(team_id);
create index if not exists idx_quiz_answers_attempt on public.quiz_answers(attempt_id);
create index if not exists idx_task_submissions_team on public.task_submissions(team_id);
create index if not exists idx_task_submissions_task on public.task_submissions(task_id);
create index if not exists idx_task_submissions_status on public.task_submissions(status);
create index if not exists idx_task_evidence_submission on public.task_evidence(submission_id);

create view public.leaderboard as
with station_totals as (
  select
    team_id,
    count(*)::integer as stations_completed,
    coalesce(sum(score), 0::numeric)::numeric(12,2) as station_points
  from public.completions
  group by team_id
),
task_totals as (
  select
    team_id,
    (count(*) filter (where status = 'approved'))::integer as tasks_completed,
    coalesce(sum(score) filter (where status = 'approved'), 0::numeric)::numeric(12,2) as task_points
  from public.task_submissions
  group by team_id
)
select
  t.id as team_id,
  t.name as team_name,
  coalesce(s.stations_completed, 0)::integer as stations_completed,
  coalesce(k.tasks_completed, 0)::integer as tasks_completed,
  (coalesce(s.stations_completed, 0) + coalesce(k.tasks_completed, 0))::integer as activities_completed,
  coalesce(s.station_points, 0::numeric)::numeric(12,2) as station_points,
  coalesce(k.task_points, 0::numeric)::numeric(12,2) as task_points,
  (coalesce(s.station_points, 0::numeric) + coalesce(k.task_points, 0::numeric))::numeric(12,2) as total_points,
  rank() over (
    order by (coalesce(s.station_points, 0::numeric) + coalesce(k.task_points, 0::numeric)) desc,
             (coalesce(s.stations_completed, 0) + coalesce(k.tasks_completed, 0)) desc,
             t.name asc
  )::integer as rank
from public.teams t
left join station_totals s on s.team_id = t.id
left join task_totals k on k.team_id = t.id;

-- Row-level security. Public browser clients can register and read game data.
-- Admin and quiz writes use the private service role only inside Vercel APIs.
alter table public.teams enable row level security;
alter table public.members enable row level security;
alter table public.stations enable row level security;
alter table public.completions enable row level security;
alter table public.settings enable row level security;
alter table public.questions enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.quiz_answers enable row level security;
alter table public.tasks enable row level security;
alter table public.task_submissions enable row level security;
alter table public.task_evidence enable row level security;

drop policy if exists "read teams" on public.teams;
create policy "read teams" on public.teams for select using (true);
drop policy if exists "insert teams" on public.teams;
create policy "insert teams" on public.teams for insert with check (true);

drop policy if exists "read members" on public.members;
create policy "read members" on public.members for select using (true);
drop policy if exists "insert members" on public.members;
create policy "insert members" on public.members for insert with check (true);
drop policy if exists "delete members" on public.members;

drop policy if exists "read stations" on public.stations;
create policy "read stations" on public.stations for select using (true);
drop policy if exists "read completions" on public.completions;
create policy "read completions" on public.completions for select using (true);
drop policy if exists "read settings" on public.settings;
create policy "read settings" on public.settings for select using (true);

-- Remove any old browser-side quiz policies. Correct answers and attempts stay private.
drop policy if exists "read questions" on public.questions;
drop policy if exists "insert quiz_attempts" on public.quiz_attempts;
drop policy if exists "read quiz_attempts" on public.quiz_attempts;
drop policy if exists "insert quiz_answers" on public.quiz_answers;
drop policy if exists "read quiz_answers" on public.quiz_answers;

-- Explicit browser grants. Team and station codes are not available in list queries.
revoke all on table public.teams from anon, authenticated;
revoke all on table public.members from anon, authenticated;
revoke all on table public.stations from anon, authenticated;
revoke all on table public.completions from anon, authenticated;
revoke all on table public.settings from anon, authenticated;
revoke all on table public.questions from anon, authenticated;
revoke all on table public.quiz_attempts from anon, authenticated;
revoke all on table public.quiz_answers from anon, authenticated;
revoke all on table public.tasks from anon, authenticated;
revoke all on table public.task_submissions from anon, authenticated;
revoke all on table public.task_evidence from anon, authenticated;

grant select (id, name, created_at) on table public.teams to anon, authenticated;
grant insert on table public.teams to anon, authenticated;
grant select, insert on table public.members to anon, authenticated;
grant select (id, name, description, sort_order, max_score, created_at) on table public.stations to anon, authenticated;
grant select on table public.completions to anon, authenticated;
grant select on table public.settings to anon, authenticated;
grant select on table public.leaderboard to anon, authenticated;

-- Exact-code lookups reveal a record only when the caller already knows its code.
drop function if exists public.get_team_by_code(text);
create function public.get_team_by_code(p_code text)
returns table (id uuid, name text, code text, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select t.id, t.name, t.code, t.created_at
  from public.teams t
  where t.code = upper(trim(p_code))
  limit 1;
$$;

drop function if exists public.get_station_by_code(text);
create function public.get_station_by_code(p_code text)
returns table (
  id uuid,
  name text,
  description text,
  code text,
  sort_order integer,
  max_score integer,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.name, s.description, s.code, s.sort_order, s.max_score, s.created_at
  from public.stations s
  where s.code = upper(trim(p_code))
  limit 1;
$$;

revoke all on function public.get_team_by_code(text) from public;
revoke all on function public.get_station_by_code(text) from public;
grant execute on function public.get_team_by_code(text) to anon, authenticated;
grant execute on function public.get_station_by_code(text) to anon, authenticated;

-- Advisors can save or undo a score only with the matching station code.
drop function if exists public.complete_task(text, uuid, integer);
drop function if exists public.complete_task(text, uuid, numeric);
create function public.complete_task(
  p_station_code text,
  p_team_id uuid,
  p_score numeric
) returns public.completions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_station public.stations;
  v_result public.completions;
begin
  select * into v_station
  from public.stations
  where code = upper(trim(p_station_code));

  if not found then raise exception 'Invalid station code'; end if;
  if not exists (select 1 from public.teams where id = p_team_id) then
    raise exception 'Team not found';
  end if;
  if p_score is null or p_score < 0 or p_score > v_station.max_score then
    raise exception 'Score % is not allowed (expected 0 to %)', p_score, v_station.max_score;
  end if;

  insert into public.completions (team_id, station_id, score)
  values (p_team_id, v_station.id, p_score)
  on conflict (team_id, station_id) do update
    set score = excluded.score, created_at = now()
  returning * into v_result;

  return v_result;
end;
$$;

create or replace function public.undo_completion(
  p_station_code text,
  p_completion_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.completions c
  using public.stations s
  where c.id = p_completion_id
    and s.id = c.station_id
    and s.code = upper(trim(p_station_code));

  if not found then raise exception 'Score not found for this station'; end if;
end;
$$;

revoke all on function public.complete_task(text, uuid, numeric) from public;
revoke all on function public.undo_completion(text, uuid) from public;
grant execute on function public.complete_task(text, uuid, numeric) to anon, authenticated;
grant execute on function public.undo_completion(text, uuid) to anon, authenticated;

-- Live updates for team, advisor, admin, and scoreboard screens.
do $$
begin
  begin alter publication supabase_realtime add table public.teams; exception when duplicate_object then null; when others then null; end;
  begin alter publication supabase_realtime add table public.members; exception when duplicate_object then null; when others then null; end;
  begin alter publication supabase_realtime add table public.stations; exception when duplicate_object then null; when others then null; end;
  begin alter publication supabase_realtime add table public.completions; exception when duplicate_object then null; when others then null; end;
  begin alter publication supabase_realtime add table public.settings; exception when duplicate_object then null; when others then null; end;
end $$;
