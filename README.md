# Motivator

React MVP using React Router Framework Mode, TypeScript, SCSS Modules, Vite,
and Supabase/PostgreSQL. It ships as a client-rendered SPA (CSR).

## Requirements

- Node.js 22.12 or newer (Node 24 LTS is recommended for this project)
- npm 10 or newer

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

## Validate and preview the production build

```powershell
npm run check
npm run preview
```

The static browser build is generated in `build/client`.

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

## Data

Without Supabase environment variables, the app uses an in-memory repository so
UI development can continue offline. Its sample catalog mirrors the supplied
Figma flow: 7 subjects, 42 modules, theory, quizzes, free answers, dashboard
metrics, and an assessment result. To connect PostgreSQL, copy `.env.example`
to `.env.local`, add the Supabase Project URL and publishable key, and apply the
SQL migrations plus `supabase/seed.sql`. See
[docs/data-layer.md](docs/data-layer.md).

## Rendering strategy

The MVP uses CSR to minimize infrastructure and delivery time. React Router still creates the initial `index.html` at build time, so the root render must remain browser-API-safe. Deploy `build/client` to static hosting and configure every URL to fall back to `index.html` (a Netlify-compatible `public/_redirects` is included).

If public SEO-sensitive pages become important, set `ssr: true`, add a server adapter, and move server data into route loaders. Existing route components do not need to be rewritten.
