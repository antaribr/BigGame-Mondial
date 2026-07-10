# BigGame — Vanilla HTML, CSS, JavaScript, JSON + Supabase

This is the framework-free conversion of **BigGame-Mondial**. The browser app uses plain HTML, one CSS file, ES-module JavaScript, and JSON configuration/sample data. It has **no React, Next.js, TypeScript, Tailwind, npm install, or frontend build step**.

Supabase is retained for shared data and live updates. Two small Supabase Edge Functions protect admin operations and grade quizzes without exposing correct answers or the service-role key.

## Features

- Team registration, member names, team codes, progress, points, rank, and optional public leaderboard
- Advisor station-code entry, live team search, 0-to-maximum scoring, edit, and undo
- Projector-friendly realtime scoreboard
- Secure admin session; station/member management; leaderboard visibility; game reset
- QR quiz station, private team-code entry, printable QR code, randomized timed attempts, server-side grading, and attempt monitoring
- Responsive, accessible UI with no external runtime CDN dependencies

## Routes

| Route | Purpose |
| --- | --- |
| `/team` | Register or rejoin a team |
| `/team/TEAMCODE` | Team dashboard |
| `/advisor` | Enter a station code |
| `/advisor/STATIONCODE` | Advisor scoring screen |
| `/scoreboard` | Full-screen live rankings |
| `/admin` | Organizer admin panel |
| `/admin/quiz` | Questions and quiz attempts |
| `/team/QRQUIZ/qr-form` | QR quiz |

## Project structure

```text
index.html                 HTML application shell
styles.css                 all frontend styling
config.json                public Supabase/quiz configuration
manifest.json              installable web-app metadata
data/sample-questions.json editable sample quiz data
js/app.js                  client-side router
js/api.js                  public Supabase data API
js/pages/*.js              route screens
js/vendor/*.js             pinned Supabase and QR libraries
supabase/schema.sql         complete schema for a new database
supabase/migrate-from-nextjs.sql
supabase/functions/        secure admin and quiz Edge Functions
vercel.json                Vercel clean-route rewrites
_redirects                 Netlify clean-route rewrites
```

## 1. Configure Supabase

### New Supabase project

1. Create a project at <https://supabase.com>.
2. Open **SQL Editor → New query**.
3. Paste all of [`supabase/schema.sql`](supabase/schema.sql), then run it.

### Existing database from the old Next.js app

1. Back up the database.
2. Run [`supabase/migrate-from-nextjs.sql`](supabase/migrate-from-nextjs.sql).
3. Then run [`supabase/schema.sql`](supabase/schema.sql).

The migration changes completion scores from integer to numeric so the quiz can safely award `0.5` points.

## 2. Connect the public browser configuration

In Supabase, open **Project Settings → API** and copy the project URL and public anon/publishable key.

### Vercel (recommended)

Add these in **Vercel project → Settings → Environment Variables**:

```text
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
```

`api/config.js` safely exposes those two public values to the browser. Add them to Production, Preview, and Development as needed, then redeploy.

### Other hosts/local development

Put the same public values directly in `config.json`:

```json
{
  "supabaseUrl": "https://YOUR-PROJECT.supabase.co",
  "supabaseAnonKey": "YOUR_PUBLIC_ANON_KEY",
  "adminFunction": "admin-api",
  "quizFunction": "quiz-api",
  "quiz": {
    "questionCount": 20,
    "seconds": 20,
    "pointsPerCorrect": 0.5
  }
}
```

> **Never** expose `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_CODE`, or `ADMIN_SESSION_SECRET` through `config.json` or `api/config.js`.

## 3. Deploy the Edge Functions

Install/use the Supabase CLI, log in, and link this directory to your project:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
```

Set private function secrets. Use your own admin code and a long random session secret:

```bash
npx supabase secrets set \
  ADMIN_CODE="choose-a-private-admin-code" \
  ADMIN_SESSION_SECRET="replace-with-a-long-random-value" \
  QUIZ_SECONDS="20" \
  QUIZ_QUESTION_COUNT="20" \
  QUIZ_POINTS_PER_CORRECT="0.5"
```

Generate a suitable random session secret with:

```bash
openssl rand -hex 32
```

Deploy both functions:

```bash
npx supabase functions deploy admin-api --no-verify-jwt
npx supabase functions deploy quiz-api --no-verify-jwt
```

`verify_jwt` is intentionally disabled at the gateway because users do not create Supabase Auth accounts. The admin function validates its own HMAC-signed admin session. The quiz function exposes only controlled start/status/submit operations. Both use the automatically provided service-role secret inside Supabase, never in the browser.

Keep `config.json` quiz values aligned with the Edge Function secrets. The function-enforced defaults are 20 questions, 20 seconds, and 0.5 points per correct answer.

## 4. Run locally

No npm packages or build are required. Start the included clean-route development server:

```bash
python3 server.py
```

Or, equivalently:

```bash
npm run serve
```

Open <http://localhost:8080>. The included server sends application routes such as `/team/ABC` to `index.html`, so direct links and browser refreshes work locally.

To perform static syntax/config checks:

```bash
npm run check
```

## 5. Add quiz questions

1. Log in at `/admin`.
2. Select **Create QR station**.
3. Open **Quiz manager**.
4. Add questions manually, or select **Import sample-questions.json**.
5. Back in admin, select **Show QR code** to print or copy the quiz link.

Edit `data/sample-questions.json` before import if you want event-specific questions. Correct answers are stored in Supabase but never returned by the public quiz API.

## 6. Deploy

### Vercel

Import this directory/repository as a Vercel project. No framework preset and no build command are needed. `vercel.json` preserves the clean application routes.

CLI alternative:

```bash
npx vercel
```

### Netlify

Publish the repository root. `_redirects` preserves the clean routes.

### Other static hosts

Serve the repository root and rewrite these paths to `/index.html`:

```text
/team/*
/advisor/*
/scoreboard
/admin/*
```

The site must use HTTPS in production so admin codes and session tokens are encrypted in transit.

## Security model

- The **anon key is public by design**. RLS restricts what it can write.
- Teams and members can be registered publicly, matching the original event workflow.
- Team and station codes are excluded from public list queries; exact-code RPCs return a match only when the caller already knows the code.
- The QR quiz requires the private team code instead of allowing someone to select another team by name.
- Scores can be changed only through RPC calls that require the station code.
- Admin writes use a service-role client only inside `admin-api`.
- Admin login returns a signed, 12-hour token stored in `sessionStorage`.
- Quiz questions assigned to an attempt exclude `correct_option`; grading happens in `quiz-api`.
- Quiz attempts have a server-enforced time limit with a five-second network grace period.

Station and team codes are shared event credentials, not user accounts. The “hide leaderboard” switch hides rankings in the team interface; it is not a cryptographic privacy boundary because anonymous clients still need public score reads for the advisor and projector workflows. For a public internet event with hostile participants, add Supabase Auth, CAPTCHA/rate limiting, separate authenticated roles, and stricter per-user policies.

## Notes about the original repository

The source repository’s `src/app/team/[code]/page.tsx` currently duplicates the advisor scoring screen. This conversion restores the intended team dashboard described in the original README. It also fixes the old quiz mismatch where `0.5`-point scores were sent to an integer-only completion function and where browser-side question access exposed correct answers.
