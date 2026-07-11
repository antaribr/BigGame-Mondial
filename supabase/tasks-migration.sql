-- ============================================================================
-- BIGGAME EVIDENCE TASKS — migration for an existing BigGame Supabase project
-- Run this entire file in Supabase Dashboard > SQL Editor.
-- ============================================================================

create extension if not exists "pgcrypto";

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

create index if not exists idx_task_submissions_team on public.task_submissions(team_id);
create index if not exists idx_task_submissions_task on public.task_submissions(task_id);
create index if not exists idx_task_submissions_status on public.task_submissions(status);
create index if not exists idx_task_evidence_submission on public.task_evidence(submission_id);

alter table public.tasks enable row level security;
alter table public.task_submissions enable row level security;
alter table public.task_evidence enable row level security;

revoke all on table public.tasks from anon, authenticated;
revoke all on table public.task_submissions from anon, authenticated;
revoke all on table public.task_evidence from anon, authenticated;

-- Private evidence bucket with image-only and 5 MB-per-file limits.
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

-- Rebuild the leaderboard so approved task points are included.
drop view if exists public.leaderboard;
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

grant select on table public.leaderboard to anon, authenticated;

-- Chronological top finishers for the organizer dashboard.
drop view if exists public.station_finishers;
create view public.station_finishers as
with totals as (
  select count(*)::integer as total_count from public.stations
),
progress as (
  select
    t.id as team_id,
    t.name as team_name,
    t.created_at as team_created_at,
    count(distinct c.station_id)::integer as completed_count,
    max(c.created_at) as finished_at
  from public.teams t
  left join public.completions c on c.team_id = t.id
  group by t.id, t.name, t.created_at
),
finishers as (
  select p.*, totals.total_count
  from progress p cross join totals
  where totals.total_count > 0 and p.completed_count = totals.total_count
)
select team_id, team_name, completed_count, total_count, finished_at,
  row_number() over (order by finished_at asc, team_created_at asc, team_name asc) as finish_order
from finishers;

drop view if exists public.task_finishers;
create view public.task_finishers as
with totals as (
  select count(*)::integer as total_count from public.tasks where active = true
),
progress as (
  select
    t.id as team_id,
    t.name as team_name,
    t.created_at as team_created_at,
    count(distinct k.id)::integer as completed_count,
    max(s.reviewed_at) filter (where k.id is not null) as finished_at
  from public.teams t
  left join public.task_submissions s on s.team_id = t.id and s.status = 'approved'
  left join public.tasks k on k.id = s.task_id and k.active = true
  group by t.id, t.name, t.created_at
),
finishers as (
  select p.*, totals.total_count
  from progress p cross join totals
  where totals.total_count > 0 and p.completed_count = totals.total_count
)
select team_id, team_name, completed_count, total_count, finished_at,
  row_number() over (order by finished_at asc, team_created_at asc, team_name asc) as finish_order
from finishers;

revoke all on table public.station_finishers from anon, authenticated;
revoke all on table public.task_finishers from anon, authenticated;
grant select on table public.station_finishers to service_role;
grant select on table public.task_finishers to service_role;
