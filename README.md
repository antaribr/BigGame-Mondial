# BigGame Mondial — Vanilla Edition

A live team game, station scoring system, scoreboard, organizer dashboard, and timed QR quiz built with:

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
- Station/member management and game reset
- Public/hidden leaderboard switch
- Timed one-attempt QR quiz with server-side grading
- Question manager and sample JSON question import
- Responsive mobile/desktop interface

## Routes

| Route | Screen |
| --- | --- |
| `/team` | Register or rejoin a team |
| `/team?code=TEAMCODE` | Team dashboard |
| `/advisor` | Enter a station code |
| `/advisor?code=STATIONCODE` | Advisor scoring |
| `/scoreboard` | Live scoreboard |
| `/admin` | Organizer dashboard |
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

The schema can also update an existing BigGame database. It creates the required tables, view, security policies, scoring functions, and realtime publication entries.

## 2. Add Vercel environment variables

Open **Vercel project → Settings → Environment Variables** and add these values:

```text
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_PRIVATE_SERVICE_ROLE_KEY
ADMIN_CODE=YOUR_PRIVATE_ADMIN_CODE
ADMIN_SESSION_SECRET=A_LONG_RANDOM_SECRET
```

Optional quiz settings:

```text
QUIZ_QUESTION_COUNT=20
QUIZ_SECONDS=20
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
4. Add questions manually or import `data/sample-questions.json`.
5. Return to admin and select **Show QR code**.
6. Print or share the generated QR code.

## Local use

### Static screens and public Supabase data

Put the public Supabase URL/key in `config.json`, then run:

```bash
npm run serve
```

Open <http://localhost:8080>.

The small local server is plain JavaScript. It serves clean routes and static assets. Vercel API routes are not emulated by this command, so organizer and quiz API actions require a deployed Vercel URL or Vercel's local development command.

### Validate and build

```bash
npm run check
npm run build
```

The build has no package dependencies. It validates JavaScript/JSON and copies only browser assets into `public/`.

## Security design

- Correct quiz answers are never returned by the public data API.
- Quiz grading and organizer writes run in server-side JavaScript functions.
- The Supabase service-role key never reaches the browser.
- Organizer sessions are signed, expire after 12 hours, and are stored in `sessionStorage`.
- Station and team codes are shared event credentials.
- Row-level security prevents browser clients from directly editing scores, stations, settings, questions, or attempts.
- Advisor score changes require the matching station code through protected database functions.
- Quiz attempts are limited by team/station and enforced by server time.

For an event exposed to hostile public traffic, add CAPTCHA/rate limiting and individual authenticated accounts. The current shared-code model is intended for managed events.
