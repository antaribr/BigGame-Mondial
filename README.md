# 🎮 The Big Game

A live, real-time team-game app for events. Teams register and track their
progress across many stations; advisor/station leaders tap a team and award a
**1–10** score; everyone watches a live leaderboard update instantly.

Built with **Next.js (App Router)**, **Supabase** (Postgres + Realtime), deploys
to **Vercel**, source on **GitHub**.

---

## ✨ What's inside

| Route | Who | What it does |
|-------|-----|--------------|
| `/` | everyone | Landing page — pick Team / Advisor |
| `/team` | team | Register a team + members, or rejoin with a code |
| `/team/[code]` | team | See all stations, your progress, points, rank, and the **public leaderboard** (live) |
| `/advisor` | advisor | Enter your station code |
| `/advisor/[code]` | advisor | See all teams → tap a team → award a **1–10** score (live, can edit/undo) |
| `/scoreboard` | big screen | Full-screen live rankings — perfect on a projector |
| `/admin` | organizer | Create/edit/delete stations, view all teams, reset game data |

**Live updates** are powered by Supabase Realtime: when an advisor scores a team,
every team's dashboard and the scoreboard refresh within a second.

---

## 🗄️ Data model

```
teams        (id, name, code, created_at)
members      (id, team_id, name)
stations     (id, name, description, code, sort_order)   ← advisor tasks
completions  (team_id, station_id, score 1–10)           ← unique per team/station
leaderboard  (view: rank, total_points, tasks_completed)
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
SUPABASE_SERVICE_ROLE_KEY=your-service-role-secret-key   # server-only
ADMIN_CODE=biggame-admin                                 # pick anything
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
2. **Advisors** → `/advisor` → type their code → they now see every team and a
   1–10 scorer.
3. **Teams** → `/team` → register name + members → get a team **code** → see all
   stations, their progress, and their rank. Rejoin anytime with the code.
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

Made for events. Have a great game! 🏆
