-- ============================================================================
-- BIGGAME ADMIN TOP FINISHERS — migration for an existing database
-- Run this entire file in Supabase Dashboard > SQL Editor.
-- ============================================================================

-- Preserve the first station-completion timestamp when an advisor edits points.
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
    set score = excluded.score
  returning * into v_result;

  return v_result;
end;
$$;

revoke all on function public.complete_task(text, uuid, numeric) from public;
grant execute on function public.complete_task(text, uuid, numeric) to anon, authenticated;

-- First teams to finish every current station.
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

-- First teams whose evidence was approved for every current active task.
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
