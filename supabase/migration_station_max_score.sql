-- ============================================================================
--  MIGRATION: per-station MAX points (replaces the scores-array model)
--  Run in Supabase → SQL Editor → New query → Run. Safe to run more than once.
--
--  Each station now has a single MAX points value. The advisor can give any
--  integer from 0 up to that max. Teams see "max of N pts".
-- ============================================================================

-- 1) Add the max_score column (default 10) if it doesn't exist.
alter table public.stations
  add column if not exists max_score int not null default 10;

-- 2) If the old `scores` int[] column exists, fold its highest value into
--    max_score, then drop it.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'stations' and column_name = 'scores'
  ) then
    update public.stations s
      set max_score = coalesce((select max(v) from unnest(scores) as v), 10);
    alter table public.stations drop column scores;
  end if;
end $$;

-- 3) Relax the completions check to a lower bound only (>= 0). The per-station
--    upper bound is enforced inside the complete_task RPC below.
alter table public.completions drop constraint if exists completions_score_check;
alter table public.completions drop constraint if exists completions_score_check1;
alter table public.completions add constraint completions_score_check
  check (score >= 0);

-- 4) Replace complete_task so it validates the score against the station's max.
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

grant execute on function public.complete_task(text, uuid, int) to anon, authenticated;
