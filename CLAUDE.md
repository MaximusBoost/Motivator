# Motivator development guide

## Commands

- `npm run dev` — local development
- `npm run typecheck` — route type generation and TypeScript validation
- `npm run build` — production SPA build
- `npm run preview` — preview the production build
- `npm run check` — full pre-commit validation

## Architecture

- `app/routes` owns route modules, page composition, metadata, loaders, and actions.
- `app/features` owns complete user-facing scenarios.
- `app/components` owns shared composite components.
- `app/ui` owns small reusable presentational primitives.
- `app/lib` owns framework-independent utilities and infrastructure.
- Keep code close to its consumer. Promote it to a shared layer only after a second real use appears.
- Use SCSS Modules for local styles and `app/styles/global.scss` for reset, tokens, and truly global rules.
- Use the `~/` alias for imports from `app`.

## Guardrails

- The MVP uses SPA mode (`ssr: false`). The root route is still rendered at build time,
  so do not access `window`, `document`, or `localStorage` during initial render.
- Use `clientLoader` and `clientAction` for route data and mutations. Non-root server
  `loader`/`action` exports are not available in SPA mode.
- Keep secrets in server-only modules and never in variables prefixed with `VITE_`.
- Add route metadata and an error state for every new public route.
- Run `npm run check` before considering a task complete.
