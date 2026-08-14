# Motivator

React MVP using React Router Framework Mode, TypeScript, SCSS Modules, and Vite. It ships as a client-rendered SPA (CSR).

## Requirements

- Node.js 22.12 or newer (Node 22 LTS is recommended for this project)
- npm 10 or newer

The currently installed Node.js 18.12.1 is too old for Vite 8. Upgrade Node before installing dependencies.

With nvm-windows:

```powershell
nvm install 22
nvm use 22
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
  features/     User scenarios grouped by domain
  components/   Shared composite components
  ui/           Reusable UI primitives
  lib/          Utilities, API clients, and infrastructure
  styles/       Global styles and design tokens
public/         Static files copied as-is
```

Start locally and keep domain code inside the route that uses it. Move code into `features`, `components`, `ui`, or `lib` only when it is genuinely shared; this prevents premature architecture from slowing development.

## Rendering strategy

The MVP uses CSR to minimize infrastructure and delivery time. React Router still creates the initial `index.html` at build time, so the root render must remain browser-API-safe. Deploy `build/client` to static hosting and configure every URL to fall back to `index.html` (a Netlify-compatible `public/_redirects` is included).

If public SEO-sensitive pages become important, set `ssr: true`, add a server adapter, and move server data into route loaders. Existing route components do not need to be rewritten.
