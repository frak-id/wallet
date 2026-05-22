# apps/business — Compass

TanStack Router SPA merchant dashboard. Largest app (415 TS/TSX). Campaigns/members/analytics. Served behind nginx in production.

## Quick Commands
```bash
bun run dev          # SST + Vite on port 3001
bun run build        # Static output (dist/)
bun run typecheck    # tsgo
bun run test         # business-unit Vitest project
```

## Key Files
- `src/routes/__root.tsx` — root shell · `src/routes/_restricted/` — auth guards for dashboard
- `src/module/{campaigns,merchant,members,dashboard,forms,login,settings,embedded,common}/` — features
  - `campaigns/` = 8 hooks · `merchant/` = 23 hooks
- `src/stores/` — Zustand stores (separate from modules)
- `nginx.conf` — production SPA fallback; local `preview` differs from prod
- `vite.config.ts` — `define` block bakes config at build time

## Non-Obvious Patterns
- **Build-time config only**: `.env` changes need full rebuild — no runtime env reflection.
- **Individual Zustand selectors are mandatory here**: this app is the most sensitive to re-render storms (345 files, many subscribers).
- **Production = nginx with pre-compressed gzip**: CI generates `.gz` siblings; vite `preview` does not serve them — expect size/cache differences.
- **Restricted-route pattern**: `_restricted` layout centralises auth; do NOT add guards per-route.
- **Consumes legacy UI**: uses `@frak-labs/ui` (Radix) + `@frak-labs/ui-preview`; design-system migration hasn't reached this app.
- **Type-safe API** via `@frak-labs/client` (Eden Treaty) — do not hand-roll fetches; the client already carries backend types.
- **i18n location**: translations live in `src/i18n/locales/{en,fr}/translation.json`; FR is the fallback (bundled), EN is lazy-loaded. Regen types via `bun run i18n:types` after adding keys. Single `translation` namespace — no `customized` namespace (wallet-only).

## Anti-Patterns
Runtime env var reads · whole-store Zustand subscription · CSS Modules or plain `.css` (use Vanilla Extract `.css.ts`) · Tailwind · adding guards per route instead of via `_restricted`.

## See Also
Parent `/AGENTS.md` · `services/backend/AGENTS.md` (API contract) · `packages/client/` (Eden Treaty) · `packages/{ui,ui-preview}/`.
