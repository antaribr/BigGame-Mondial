# 🎮 The Big Game

A live, real-time team-game app for events with a clean **light/white theme**.
Teams register and track their progress across many stations; advisor/station
leaders tap a team and award a **1–10** score; everyone watches a live
leaderboard update instantly.

**The two roles are fully separated** — there is no shared entrance. Each role
gets its own dedicated link:

- 🏃 **Teams** → `https://your-app.vercel.app/team`
- 🎯 **Advisors** → `https://your-app.vercel.app/advisor`

A team member can never reach the advisor section from their link (and vice
versa). The home page (`/`) is just a neutral organizer hub (scoreboard + admin).

Built with **Next.js (App Router)**, **Supabase** (Postgres + Realtime), deploys
to **Vercel**, source on **GitHub**.

---

## ✨ What's inside

| Route | Who | What it does |
|-------|-----|--------------|
| `/` | — | Redirects to `/team` (no landing/choose screen) |
| `/team` | team | **Team portal entry** — register a team + members, or rejoin with a code |
| `/team/[code]` | team | See all stations, your progress, points, rank, and the **public leaderboard** (live) |
| `/advisor` | advisor | **Advisor portal entry** — enter your station code |
| `/advisor/[code]` | advisor | See all teams → tap a team → award a **1–10** score (live, can edit/undo) |
| `/scoreboard` | big screen | Full-screen live rankings — perfect on a projector |
| `/admin` | organizer | Create/edit/delete stations, view all teams, reset game data |

> 🔒 **Separation:** the team portal only links within `/team/*`; the advisor
> portal only links within `/advisor/*`. Hand out the two links above — neither
> role can navigate to the other's screens.

**Live updates** are powered by Supabase Realtime: when an advisor scores a team,
every team's dashboard and the scoreboard refresh within a second.

---

## 🗄️ Data model

```
teams (id, name, code, created_at)
members (id, team_id, name)
stations (id, name, description, code, sort_order) ← advisor tasks
completions (team_id, station_id, score 1–10) ← unique per team/station
leaderboard (view: rank, total_points, tasks_completed)
```

### 🔒 How scoring stays fair
Scores are **not** written directly to the table. The app calls two
`SECURITY DEFINER` Postgres functions that validate the advisor's **station
code**:

- `complete_task(station_code, team_id, score)` — insert/update a score
- `undo_completion(station_code, completion_id)` — remove a score

So even though the browser only holds the public `anon` key, a participant
**cannot** forge points for their own team — they'd need a valid station code,
which only the advisor at each station has. Station creation/deletion is
gated behind the admin panel, which uses the server-only **service role** key.

---

## 🚀 Setup (≈ 10 minutes)

### 1. Create the Supabase project
1. Go to [supabase.com](https://supabase.com) → **New project**.
2. Once ready, open **SQL Editor → New query**, paste the entire contents of
 [`supabase/schema.sql`](./supabase/schema.sql), and **Run**.
3. Go to **Project Settings → API** and copy:
 - `Project URL`
 - `anon` public key
 - `service_role` secret key

### 2. Configure environment variables
Copy `.env.local.example` → `.env.local` and fill in the values:

```bash
cp .env.local.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-secret-key # server-only
ADMIN_CODE=biggame-admin # pick anything
```

### 3. Run locally
```bash
npm install
npm run dev
```
Open http://localhost:3000.

> Requires **Node.js 18.18+** (Node 20 recommended).

---

## 🎯 Event-day workflow

1. **Organizer** → `/admin` → enter `ADMIN_CODE` → **Add a station** for each
 task/advisor. Give each advisor their station **code** (shown next to each
 station). Stations sort by the *Order* field.
2. **Advisors** → give them the **advisor link**: `https://your-app.vercel.app/advisor`
 → they type their station code → they now see every team and a 1–10 scorer.
3. **Teams** → give them the **team link**: `https://your-app.vercel.app/team`
 → register name + members → get a team **code** → see all stations, their
 progress, and their rank. Rejoin anytime with the code.
4. (Optional) Put `/scoreboard` on a big screen for live hype.

---

## ☁️ Deploy to GitHub + Vercel

1. **Push to GitHub** (Vercel connects directly to your repo):
 ```bash
 git init
 git add .
 git commit -m "The Big Game"
 git branch -M main
 git remote add origin https://github.com/YOU/big-game.git
 git push -u origin main
 ```
2. Go to [vercel.com](https://vercel.com) → **Add New → Project** → import the repo.
3. In **Settings → Environment Variables**, add the **same four** variables from
 your `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
 `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_CODE`).
4. **Deploy**. Done — Vercel rebuilds on every push to `main`.

> No build step in Supabase is needed after the initial `schema.sql` run.
> Re-running `schema.sql` is safe (idempotent).

---

## 🛠️ Tech & customization

- **Next.js 15** App Router (React 19), **TypeScript**, **Tailwind CSS**
- **@supabase/supabase-js** for data + Realtime
- Fonts: Inter + Space Grotesk via `next/font`
- Colors/branding live in `tailwind.config.ts` and `src/app/globals.css`
- All data access is in `src/lib/api.ts`; DB types in `src/lib/types.ts`

### Tips
- **Change the scoring scale?** Edit the `check (score between 1 and 10)`
 constraint in `schema.sql` and the 10-button grid in
 `src/app/advisor/[code]/page.tsx`.
- **Want teams hidden from each other?** Swap the leaderboard tab out and
 tighten the `read` RLS policies.
- **Need a QR code per station?** Link each advisor tablet to
 `https://your-app.vercel.app/advisor/STATIONCODE`.

---

## 📱 QR Code Quiz System

A quiz station where teams scan a QR code and answer 20 shuffled questions in 20 seconds.

### How It Works

1. **Admin creates the station** (in Admin Dashboard → click "Create QR Quiz Station")
2. **Teams scan the QR code** → goes to `/team/{stationCode}/qr-form`
3. **Teams select their team** → click "Start Quiz"
4. **Answer 20 shuffled questions** in 20 seconds (auto-submit on timeout)
5. **Points are auto-added** to the station (0.5 pts per correct answer)

### Features

- ✅ Questions are shuffled per team (everyone gets different order)
- ✅ 20-second countdown timer
- ✅ One attempt per team (prevents cheating)
- ✅ Auto-awards points to the "Find and Scan the QR code" station
- ✅ Full admin panel to manage questions

### Database Setup

Run the quiz schema in Supabase SQL Editor:

```sql
-- Questions table
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

-- Quiz attempts (prevents duplicate attempts)
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

-- Quiz answers (audit trail)
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
```

### QR Code

Generate a QR code pointing to:
```
https://your-app.vercel.app/team/QRQUIZ/qr-form
```

Or use the station code `QRQUIZ` to create your own link:
```
https://your-app.vercel.app/team/{yourStationCode}/qr-form
```

### Admin Quiz Manager

Access via `/admin/quiz` or click "Open Quiz Manager" in the admin dashboard.

Features:
- Add/edit/delete questions
- View all quiz attempts
- Reset quiz attempts (allow teams to retake)
- See real-time stats

---

Made for events. Have a great game! 🏆
