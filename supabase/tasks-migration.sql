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
