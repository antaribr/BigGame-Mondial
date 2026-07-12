# BigGame Mondial — Vanilla Edition

A live team game with station scoring, evidence-based tasks, a leaderboard, organizer tools, and a timed QR quiz built with:

- HTML
- CSS
- browser JavaScript modules
- JSON configuration/data
- plain JavaScript Vercel API functions
- Supabase for shared data and realtime updates

There is no UI framework, compiler, bundler, generated component system, or runtime package dependency.

## What is included

- Team registration and private rejoin codes
- Team members, progress, scores, and rank
- Advisor station-code access, scoring, editing, and undo
- Realtime projector scoreboard
- Protected organizer login and dashboard
- Station, team-name, and member management with game reset
- Public/hidden leaderboard switch
- Timed one-attempt QR quiz with server-side grading
- Compatible with the existing `questions`, `quiz_attempts`, and `quiz_answers` tables—no extra assignment table
- Question manager with Excel import/export and sample JSON import
- Team dashboard with two large sections: **Tasks & Stations** and **Leaderboard**
- Dedicated auto-refreshing task-leader portal for creating tasks and reviewing evidence
- Up to five private evidence pictures per team/task submission
- Approve/reject workflow with leader notes and custom points
- Approved task points included automatically in the leaderboard
- Admin top-three lists for the first teams to finish all stations and all active tasks
- Printable full report with every team’s station/task status, scores, timestamps, notes, and totals
- Responsive mobile/desktop interface

## Routes

| Route | Screen |
| --- | --- |
| `/team` | Register or rejoin a team |
| `/team?code=TEAMCODE` | Team dashboard |
| `/advisor` | Enter a station code |
| `/advisor?code=STATIONCODE` | Advisor scoring |
| `/scoreboard` | Live scoreboard |
| `/task-leader` | Create tasks, review evidence, and award points |
| `/admin` | Organizer dashboard |
| `/admin/report` | Printable full station/task/team report |
| `/admin/quiz` | Quiz manager |
| `/team/qr-form?station=QRQUIZ` | Team QR quiz |

## Project structure

```text
index.html                  single application shell
styles.css                  all visual styles
manifest.json               installable web app metadata
config.json                 local/static public configuration
vercel.json                 explicit Vercel build and route configuration
api/config.js               public runtime configuration
api/admin.js                protected organizer API
api/quiz.js                 protected quiz/grading API
api/tasks.js                task, evidence, upload, and leader API
js/app.js                   browser router and application startup
js/api.js                   public Supabase data operations
js/pages/*.js               screen modules
js/vendor/*.js              bundled browser libraries
data/sample-questions.json  editable sample questions
scripts/check.js             dependency-free source checks
scripts/build.js             copies public assets into public/
scripts/serve.js             dependency-free local static server
supabase/schema.sql          complete database schema and policies
```

## 1. Create or update Supabase

1. Create a Supabase project.
2. Open **SQL Editor → New query**.
3. Copy all of `supabase/schema.sql` into the editor.
4. Run it.

The schema can also update an existing BigGame database. It creates the required tables, private evidence bucket, leaderboard view, security policies, scoring functions, and realtime publication entries. If the core database is already configured and you only need the new evidence-task feature, run `supabase/tasks-migration.sql` instead.

## 2. Add Vercel environment variables

Open **Vercel project → Settings → Environment Variables** and add these values:

```text
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_PRIVATE_SERVICE_ROLE_KEY
ADMIN_CODE=YOUR_PRIVATE_ADMIN_CODE
TASK_LEADER_CODE=YOUR_PRIVATE_TASK_LEADER_CODE
ADMIN_SESSION_SECRET=A_LONG_RANDOM_SECRET
```

Optional quiz settings:

```text
QUIZ_QUESTION_COUNT=20
QUIZ_SECONDS=40
QUIZ_POINTS_PER_CORRECT=0.5
```

Apply the variables to Production and Preview, then redeploy.

Generate a strong session secret with:

```bash
openssl rand -hex 32
```

### Secret safety

`SUPABASE_ANON_KEY` is a public browser key. The following values are private and must exist only in Vercel Environment Variables:

- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_CODE`
- `TASK_LEADER_CODE`
- `ADMIN_SESSION_SECRET`

Never place those private values in `config.json`, browser JavaScript, Git, or screenshots.

## 3. Deploy on Vercel

Import this repository into Vercel and deploy it. The repository configuration explicitly selects a framework-free build, runs the plain JavaScript checks/build script, publishes `public/`, and enables the clean application routes.

The effective settings are:

```text
Framework Preset: Other
Build Command: npm run build
Output Directory: public
Root Directory: repository root
```

If this repository is attached to more than one Vercel project, disconnect the duplicate project so each push creates only one deployment.

After changing environment variables, use **Redeploy → Clear build cache and redeploy**.

## 4. First-time organizer setup

1. Open `/admin` and enter `ADMIN_CODE`.
2. Add activity stations or select **Create QR station**.
3. Open **Quiz manager**.
4. Add questions manually, import an Excel workbook, or import `data/sample-questions.json`.
5. Return to admin and select **Show QR code**.
6. Print or share the generated QR code.
7. Open `/task-leader`, enter `TASK_LEADER_CODE`, and create evidence tasks.

## Evidence-task workflow

1. The task leader opens `/task-leader` and creates a task with instructions, order, and maximum points.
2. The team opens its dashboard and selects **Tasks & Stations**.
3. Stations appear first, followed by evidence tasks.
4. The team selects **Submit evidence** and uploads 1–5 JPG, PNG, WebP, or GIF pictures (maximum 5 MB each).
5. Evidence is stored in the private `task-evidence` Supabase Storage bucket.
6. The task leader reviews the team name, task name, and pictures.
7. The leader approves with 0–maximum points, or rejects with a note so the team can resubmit.
8. Approved task points are added automatically to the main leaderboard.

Run `supabase/tasks-migration.sql` on an existing database (or the complete `supabase/schema.sql`). It creates the `tasks`, `task_submissions`, and `task_evidence` tables, updates the leaderboard view, and creates the private Storage bucket.

## Admin top finishers

The admin dashboard shows two chronological top-three lists:

- First teams to complete every current station
- First teams to receive approval for every current active task

For an existing database, run `supabase/admin-finishers-migration.sql`. The finish time is the time of the final required station completion or final active-task approval. Editing points later does not change the original finish time.

## Excel question import and export

Open **Admin → Quiz manager**:

- **Excel template** downloads a ready-to-fill workbook with headers, instructions, formatting, and an A–D dropdown.
- **Export Excel** downloads all current questions as an `.xlsx` workbook.
- **Import Excel** accepts `.xlsx`, `.xls`, `.xlsm`, and `.csv` files up to 5 MB.

The `Questions` sheet uses these columns:

```text
ID | Question | Option A | Option B | Option C | Option D | Correct Option
```

`Correct Option` must be `A`, `B`, `C`, or `D`. Keep the ID when editing an exported question so import updates it. Leave ID blank for a new question. The importer validates every row before writing anything and supports up to 500 questions per file.

## Local use

### Static screens and public Supabase data

Put the public Supabase URL/key in `config.json`, then run:

```bash
npm run serve
```

Open <http://localhost:8080>.

The small local server is plain JavaScript. It serves clean routes and static assets. Vercel API routes are not emulated by this command, so organizer, quiz, task-leader, and evidence-upload actions require a deployed Vercel URL or Vercel's local development command.

### Validate and build

```bash
npm run check
npm run build
```

The build has no package dependencies. It validates JavaScript/JSON and copies only browser assets into `public/`.

## Security design

- Correct quiz answers are never returned by the public data API.
- Quiz grading, task reviews, and organizer writes run in server-side JavaScript functions.
- Evidence is stored in a private bucket and accessed through short-lived signed upload/download URLs.
- The Supabase service-role key never reaches the browser.
- Organizer and task-leader sessions are signed, expire after 12 hours, and are stored in `sessionStorage`.
- Station and team codes are shared event credentials.
- Row-level security prevents browser clients from directly editing scores, stations, settings, questions, or attempts.
- Advisor score changes require the matching station code through protected database functions.
- Quiz attempts are limited by team/station and enforced by server time.

For an event exposed to hostile public traffic, add CAPTCHA/rate limiting and individual authenticated accounts. The current shared-code model is intended for managed events.
