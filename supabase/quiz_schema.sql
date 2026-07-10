-- ============================================================================
-- QR QUIZ SYSTEM — Run this in Supabase SQL Editor
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- Questions table
-- ─────────────────────────────────────────────────────────────────────────────
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

alter table public.questions enable row level security;
create policy "read questions" on public.questions for select using (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- Quiz attempts — prevents duplicate attempts per team
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  station_id uuid not null references public.stations(id) on delete cascade,
  score decimal(5,2) not null default 0,
  questions_answered int not null default 0,
  correct_answers int not null default 0,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint unique_team_station unique (team_id, station_id)
);

alter table public.quiz_attempts enable row level security;
create policy "insert quiz_attempts" on public.quiz_attempts for insert with check (true);
create policy "read quiz_attempts" on public.quiz_attempts for select using (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- Quiz answers — stores each answer for audit
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.quiz_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.quiz_attempts(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  selected_option text check (selected_option in ('A', 'B', 'C', 'D', null)),
  is_correct boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.quiz_answers enable row level security;
create policy "insert quiz_answers" on public.quiz_answers for insert with check (true);
create policy "read quiz_answers" on public.quiz_answers for select using (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- Sample questions (uncomment to use)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.questions (question, option_a, option_b, option_c, option_d, correct_option) VALUES
('What year was this event first held?', '2020', '2021', '2022', '2023', 'B'),
('How many stations are there in total?', '3', '5', '7', '10', 'C'),
('What is the maximum points per station?', '5', '10', '15', '20', 'B'),
('Which color was NOT used in our branding?', 'Red', 'Green', 'Blue', 'Yellow', 'B'),
('How long do you have for the QR quiz?', '10 seconds', '20 seconds', '30 seconds', '60 seconds', 'B'),
('What is the mascot of this event?', 'Lion', 'Eagle', 'Bear', 'Wolf', 'A'),
('Which city is this event held in?', 'Beirut', 'Paris', 'London', 'Dubai', 'A'),
('What day does the event start?', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'C'),
('How many teams can participate?', '10', '20', '50', 'Unlimited', 'D'),
('What is the entry fee?', 'Free', '$10', '$25', '$50', 'A'),
('How many questions are in the QR quiz?', '10', '15', '20', '25', 'C'),
('Each correct answer gives how many points?', '0.25', '0.5', '1', '2', 'B'),
('What happens if time runs out?', 'Zero points', 'Partial points', 'Extra time', 'Disqualification', 'B'),
('Can teams take the quiz twice?', 'Yes', 'No', 'Only if first attempt failed', 'Depends on station', 'B'),
('How are questions ordered?', 'Alphabetical', 'By difficulty', 'Random/Shuffled', 'Based on team code', 'C'),
('Who can score teams at stations?', 'Advisors', 'Teams themselves', 'Anyone', 'Only admins', 'A'),
('What is the team portal URL?', '/team', '/admin', '/scoreboard', '/advisor', 'A'),
('How many points is the QR quiz worth in total?', '5', '10', '15', '20', 'B'),
('What shows on the scoreboard?', 'Team rankings', 'Only your team', 'Station info', 'Nothing', 'A'),
('Where do advisors enter their code?', '/team', '/advisor', '/admin', '/scoreboard', 'B');
