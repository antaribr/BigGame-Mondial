-- ============================================================================
-- BIGGAME VANILLA — migrate an EXISTING database made by the Next.js version
-- Back up first. Run once in Supabase Dashboard > SQL Editor, then run
-- schema.sql to ensure all policies, functions, indexes, and tables are current.
-- ============================================================================

begin;

-- The old leaderboard depends on completions.score, so remove it before changing
-- integer scores to numeric scores (needed for 0.5-point quiz answers).
drop view if exists public.leaderboard;
drop function if exists public.complete_task(text, uuid, integer);
drop function if exists public.complete_task(text, uuid, numeric);

alter table public.completions drop constraint if exists completions_score_check;
alter table public.completions
  alter column score type numeric(8,2) using score::numeric;
alter table public.completions
  add constraint completions_score_check check (score >= 0);

alter table public.quiz_attempts
  alter column score type numeric(8,2) using score::numeric;

create table if not exists public.quiz_attempt_questions (
  attempt_id uuid not null references public.quiz_attempts(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  position integer not null,
  primary key (attempt_id, question_id),
  unique (attempt_id, position)
);

-- Ensure repeated submissions cannot duplicate answer rows.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'quiz_answers_attempt_question_key'
      and conrelid = 'public.quiz_answers'::regclass
  ) then
    -- Remove legacy duplicates before adding the unique constraint.
    delete from public.quiz_answers a
    using public.quiz_answers b
    where a.attempt_id = b.attempt_id
      and a.question_id = b.question_id
      and a.created_at < b.created_at;
    alter table public.quiz_answers
      add constraint quiz_answers_attempt_question_key unique (attempt_id, question_id);
  end if;
end $$;

alter table public.quiz_attempt_questions enable row level security;

-- Correct options and quiz writes must no longer be exposed to anonymous clients.
drop policy if exists "read questions" on public.questions;
drop policy if exists "insert quiz_attempts" on public.quiz_attempts;
drop policy if exists "read quiz_attempts" on public.quiz_attempts;
drop policy if exists "insert quiz_answers" on public.quiz_answers;
drop policy if exists "read quiz_answers" on public.quiz_answers;

commit;

-- Finish by running schema.sql. It recreates the leaderboard and numeric RPC.
