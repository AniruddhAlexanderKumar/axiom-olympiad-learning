# Zumi

A mobile-first, Duolingo-style app that teaches coding through short daily lessons and trains students for programming contests. Two modes share one progress system:

- **Learn** — Python from zero, nine skills from `print()` to classes.
- **Compete** — contest preparation (USACO Bronze/Silver/Gold, ACSL Junior) with contest-style grading, editorials and timed mock contests.

Built with **Expo (React Native)** for iOS, Android and web, an **Express** API, **PostgreSQL**, and **Judge0** for sandboxed code execution.

## Layout

```
app/        Expo client (expo-router, React Native, TypeScript)
server/     Express API, PostgreSQL migrations, Judge0 client, tests
content/    Lesson, problem, contest and placement content as JSON
render.yaml Render blueprint: web service + PostgreSQL
```

The API serves everything under `/api`, so the exported web client and the API
can run on one origin (`/health` stays at the root for platform health checks).

## Getting started

```bash
npm run install:all          # root, server and app dependencies

# terminal 1 — API on :4000
npm run dev:api

# terminal 2 — Expo (press w for web, or scan the QR code)
npm run dev:app
```

Without further configuration the API runs on an embedded **PGlite** database in
`server/.data/pglite`, so the app works immediately. To use real PostgreSQL:

```bash
cp .env.example .env         # set DATABASE_URL, JWT_SECRET, JUDGE0_URL
docker compose up postgres
```

`server/src/env.ts` reads `.env` from the repo root or `server/`, and variables
already in the environment always win. For the Expo app, `EXPO_PUBLIC_API_URL`
defaults to `http://localhost:4000` in development; on a physical device point it
at your computer's LAN address.

### Single-origin build

```bash
npm run build                # expo export --platform web -> app/dist
npm start                    # API + web client on http://localhost:4000
```

The API serves `app/dist`, with a SPA fallback for client routes and a JSON 404
for unknown `/api` calls. Build the web client with `EXPO_PUBLIC_API_URL=/` (or
leave it unset in a production build) so the bundle calls its own origin.

## Deploying to Render

`render.yaml` is a complete blueprint: one Node web service plus a Render
Postgres database. In the Render dashboard choose **New → Blueprint**, point it
at this repository, and apply. The blueprint:

- runs `npm run render:build`, which installs both packages and exports the web
  client into `app/dist`;
- starts the API with `npm run render:start` on the `PORT` Render provides,
  bound to `0.0.0.0`;
- injects `DATABASE_URL` from the managed database and generates `JWT_SECRET`;
- health-checks `/health`;
- sets `EXPO_PUBLIC_API_URL=/` so the browser bundle uses the same origin.

Postgres TLS is detected automatically: Render's internal hostname needs none,
its external URL does. Set `DATABASE_SSL=true|false` to override, and
`PUBLIC_URL` if the service is served from a custom domain (Render otherwise
uses `RENDER_EXTERNAL_URL`).

The service fails fast at boot if `DATABASE_URL` is missing on Render, because
Render's filesystem is ephemeral and the embedded PGlite database would be lost
on every deploy.

### Free-tier limits on Render

The blueprint starts on Render's free plans so a first deploy costs nothing, but
"free" has real edges:

- a free web service spins down after 15 minutes without traffic and takes about
  a minute to wake. For an actual contest window, raise the service to the
  `starter` plan ($7/mo) so it stays warm;
- a free Postgres database **expires 30 days after creation**, with a 14-day
  grace period before Render deletes it and its data. For a term-long
  deployment, either upgrade the database to a paid plan or set `DATABASE_URL`
  yourself to a database that does not expire (Neon's free tier works). No code
  changes are needed: delete the `databases:` block and the `fromDatabase:`
  entry from `render.yaml`, and provide `DATABASE_URL` as a normal environment
  variable;
- free instances have an ephemeral filesystem, which is why the service refuses
  to boot on Render without `DATABASE_URL`: the embedded PGlite database would
  be wiped on every restart.

### Code execution (Judge0)

Student code is **never** executed on the API server, and Render cannot run the
Docker containers in `docker-compose.yml`. Point `JUDGE0_URL` at either:

- the **RapidAPI-hosted** Judge0 (also set `JUDGE0_KEY` and `JUDGE0_HOST`), or
- a self-hosted Judge0 instance reachable over HTTPS (Run it on a machine that
  allows privileged containers), or
- the public `https://ce.judge0.com` instance for a quick demo only: it is rate
  limited, shared by everyone, and should not receive real student submissions.

Locally, self-host it with:

```bash
docker compose up judge0 judge0-db judge0-redis judge0-worker
# JUDGE0_URL=http://localhost:2358
```

Until `JUDGE0_URL` is set, tappable question types and all lesson flows work
normally, and code submissions return a clear `503` explaining that execution is
not configured. `/health` reports the same state as `judge0`.

## Question types

Every lesson mixes tappable formats with a free-response challenge, ordered from easier to harder:

| Type | File shape | Grading |
| --- | --- | --- |
| `mcq` | `options`, `answer` | selected option id |
| `true-false` | `statement`, `answer` | boolean |
| `fill-blank` | `template` with `{{0}}`, `blanks[].answers` | normalised text |
| `word-bank` | same, `mode: "wordbank"`, `bank` | chip selection |
| `order` | `lines`, `answer` (line ids) | exact sequence |
| `match` | `pairs` | every pair |
| `bug` | `lines`, `fixes`, `answer {lineId, fixId}` | line + fix |
| `frq` | `starterCode`, hidden `tests` | Judge0 per test case |

Answers, hidden tests and explanations live only on the server: `server/src/serialize.ts` strips them before a question is sent to the client, and `server/src/grade.ts` does all grading.

## Content

Content is JSON, loaded at boot by `server/src/content.ts`, so writers can add material without touching code:

```
content/learn/python/track.json          skill tree (9 skills, ordered lessons)
content/learn/python/lessons/*.json      lessons with 4-6 challenges each
content/compete/usaco.json               tiers, topics, 9 problems with hidden tests
content/compete/acsl.json                ACSL Junior track
content/contests.json                    weekly mock + warm-up sprint
content/placement.json                   onboarding placement quiz
```

All lessons and problems are original sample material written for this app. They are **not** official AMC/USACO/ACSL syllabus or past-paper content, and the mock contest is a practice simulation, not a real contest.

## Gamification and progression

- **XP and levels** per challenge, with a perfect-lesson bonus and first-solve problem points (`server/src/progress.ts`).
- **Hearts** (5 max): a wrong lesson answer costs one, they refill every 25 minutes, and finishing a review session grants one. Practice and review never cost hearts.
- **Streaks** with a 28-day heatmap and streak freezes earned every seven days; a freeze covers a missed day automatically.
- **Spaced repetition**: missed challenges return after two days, in both modes, with the same question re-queued at the end of the current lesson until answered correctly.
- **Unlocks**: finishing Learn skills opens Compete tiers (`unlockSkills` in the track JSON — loops, lists and strings open USACO Bronze).
- **Weekly leagues** grouped by tier, ranked by XP earned this week, with promotion for the top three and demotion for the bottom four when the week resets.
- **Badges**, **friend races** (share a code, both players submit the same problem) and **mock contests** scored per test case.

## API surface

All routes are under `/api`:

`POST /auth/register|login`, `GET /auth/me`, `GET/POST /auth/onboarding`, `GET/POST /auth/onboarding/placement`, `GET /learn`, `POST /learn/lessons/:id/start`, `POST /lesson-sessions/:id/answer`, `GET/POST /review`, `GET /compete`, `GET /compete/topics/:id`, `POST /compete/topics/:id/check`, `GET /problems/:id`, `POST /problems/:id/submit`, `GET /problems/:id/editorial`, `GET/POST /contests`, `POST /contests/:id/start|submit|finish`, `GET/PATCH /me`, `GET /me/leagues|badges`, `GET/POST /friend-challenges`. Health: `GET /health`.

## Tests and checks

```bash
npm run typecheck    # server + app TypeScript
npm test             # API tests against PGlite (auth, lessons, hearts, review, locks, Judge0 offline)
```

## Known limits

- Python is the only Learn track with content; Java, JavaScript and C++ appear as "soon" tracks, though the model, editor language bar and Judge0 language ids already support them.
- Code editor syntax highlighting is a monospace editor with line numbers, auto-indent and a symbol bar, not a full tokenised highlighter.
- Drag and drop is implemented as tap-to-place (order, match, word bank) so it works with a keyboard and screen reader.
- Sound effects are not bundled; feedback is visual plus haptics.
- Accounts use email + password only; no third-party sign-in.
