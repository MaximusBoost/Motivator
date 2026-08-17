# Motivator

React MVP using React Router Framework Mode, TypeScript, SCSS Modules, Vite,
and Supabase/PostgreSQL. It ships as a client-rendered SPA (CSR).

## Requirements

- Node.js 22.12 or newer (Node 24 LTS is recommended for this project)
- npm 10 or newer
- Docker Desktop (only for the local Supabase stack)

With nvm-windows, if Node needs to be installed or updated:

```powershell
nvm install 24
nvm use 24
node --version
```

## Start

```powershell
npm install
npm run dev
```

Open http://localhost:5173.

Without `.env.local`, open `/login` and either register a browser-local test
account or use **Open demo account**. With Supabase variables configured, the
same forms use Supabase Auth (email + password) and store the unique username
in `public.profiles`.

## Validate and preview the production build

```powershell
npm run check
npm run preview
```

The static browser build is generated in `build/client`.

## Local Supabase

The Supabase CLI is pinned as a project dev dependency, so no global CLI
installation is needed. With Docker Desktop running:

```powershell
npm run supabase:start
npm run supabase:reset
npm run supabase:lint
npm run smoke:supabase
```

`supabase:reset` targets only the local database and replays every migration
followed by `supabase/seed.sql`. The smoke test creates two temporary users,
checks Auth, seed data, RLS isolation and both grading RPCs, then removes those
users. Stop the stack with `npm run supabase:stop`.

For the browser app, take the local API URL and publishable key from
`npm run supabase:status`, put them in `.env.local` as
`VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`, then restart
`npm run dev`. Never put the secret/service-role key in a `VITE_*` variable.

## Project structure

```text
app/
  routes/       Route modules and pages
  data/         Domain types and data repositories
  features/     User scenarios grouped by domain
  components/   Shared composite components
  ui/           Reusable UI primitives
  lib/          Utilities, API clients, and infrastructure
  styles/       Global styles and design tokens
public/         Static files copied as-is
supabase/       PostgreSQL migrations and development seed data
```

Start locally and keep domain code inside the route that uses it. Move code into `features`, `components`, `ui`, or `lib` only when it is genuinely shared; this prevents premature architecture from slowing development.

Implemented MVP routes:

- `/login`, `/register` — authentication;
- `/` — personal dashboard;
- `/subjects`, `/subjects/:subjectSlug` — catalog and subject modules;
- `/modules/:moduleId`, `/activities/:activityId` — theory, quizzes and free answers;
- `/results`, `/results/:attemptId` — assessment history and details;
- `/onboarding`, `/qualification` — qualification goal and personal route;
- `/qualification/exam`, `/qualification/exam/results/:attemptId` — mock qualification exam;
- `/practice` — self-reported professional and physical results;
- `/progress`, `/goals`, `/profile` — progress, subject grades and account.

## Data

Without Supabase environment variables, the app uses an in-memory repository so
UI development can continue offline. Its sample catalog mirrors the supplied
Figma flow: 7 subjects, 42 modules, theory, quizzes, free answers, dashboard
metrics, and an assessment result. To connect PostgreSQL, copy `.env.example`
to `.env.local`, add the Supabase Project URL and publishable key, and apply the
SQL migrations plus `supabase/seed.sql`. See
[docs/data-layer.md](docs/data-layer.md).

Four subjects now contain source-based MVP material: medical training, RHB
protection, military topography, and military regulations (25 modules, 50
theory sections, 75 questions, and 7 free-answer tasks). The other three
subjects intentionally retain their placeholders. Edit
`app/data/curriculum-content.ts`, then run `npm run content:seed`; do not edit
the generated `supabase/seed.sql` by hand. Source mapping, version caveats, and
review requirements are documented in [docs/curriculum.md](docs/curriculum.md).

Apply migrations in filename order. The `202608170001_qualification_journey`
migration adds the qualification profile, self-reported practice journal and a
trusted `submit_qualification_exam` RPC. Quiz answer keys remain inaccessible
to the browser; both ordinary and qualification tests are scored in PostgreSQL.

Free answers are stored with `submitted` status and can be reviewed by
`supabase/functions/review-free-answer`; physical results can trigger
`supabase/functions/advise-physical-training`. Both functions use the shared
OpenAI Responses API adapter with strict Structured Outputs and the server-only
`OPENAI_API_KEY` secret; the model is configurable with `OPENAI_MODEL`. See
[docs/ai-review.md](docs/ai-review.md). The current qualification result is a
training forecast, not an official assessment or award.

The product scope is limited to active service members. Onboarding requires an
explicit confirmation and stores only a generalized service profile. Do not
store unit numbers, exact positions, VUS, locations, or restricted material.
The subject ordering derived from the generalized profile is an application
recommendation only; it is not an official curriculum or commission list.

## Rendering strategy

The MVP uses CSR to minimize infrastructure and delivery time. React Router still creates the initial `index.html` at build time, so the root render must remain browser-API-safe. Deploy `build/client` to static hosting and configure every URL to fall back to `index.html` (a Netlify-compatible `public/_redirects` is included).

If public SEO-sensitive pages become important, set `ssr: true`, add a server adapter, and move server data into route loaders. Existing route components do not need to be rewritten.
