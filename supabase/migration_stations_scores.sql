-- ============================================================================
-- MIGRATION: per-station scoring scales
-- Run in Supabase → SQL Editor → New query → Run.
-- Safe to run more than once.
--
-- Lets each station define its OWN set of allowed scores:
-- • Full scale: 1..10
-- • 1..5
-- • Bronze/Silver/Gold: 3,5,10
-- • Pass/Fail: 0,10
-- • Custom: any subset of 0..10
-- ============================================================================

-- 1) Add the scores array to existing stations (default = full 1–10 scale).
alter table public.stations
  add column if not exists scores int[] not null default '{1,2,3,4,5,6,7,8,9,10}';

update public.stations
  set scores = '{1,2,3,4,5,6,7,8,9,10}'
  where scores is null or array_length(scores, 1) is null;

-- 2) Allow 0 as a score (for pass/fail stations). Keep the hard cap at 10.
alter table public.completions drop constraint if exists completions_score_check;
alter table public.completions drop constraint if exists completions_score_check1;
alter table public.completions add constraint completions_score_check
  check (score between 0 and 10);

-- 3) Replace complete_task so it validates the score against the station's
-- allowed scores array (instead of a hardcoded 1–10 range).
create or replace function public.complete_task(
  p_station_code text,
  p_team_id uuid,
  p_score int
) returns public.completions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_station public.stations;
  v_result public.completions;
begin
  select * into v_station from public.stations where code = upper(p_station_code);
  if not found then
    raise exception 'Invalid station code';
  end if;

  if p_score is null or not (p_score = any(v_station.scores)) then
    raise exception 'Score % is not allowed for this station (allowed: %)',
      p_score, v_station.scores;
  end if;

  insert into public.completions (team_id, station_id, score)
  values (p_team_id, v_station.id, p_score)
  on conflict (team_id, station_id) do update
  set score = excluded.score
  returning * into v_result;

  return v_result;
end;
$$;

-- keep grants in place
grant execute on function public.complete_task(text, uuid, int) to anon, authenticated;
