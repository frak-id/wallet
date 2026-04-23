# apps/wallet — Compass

TanStack Router SPA user wallet. SSR disabled. Module-based. Service worker mandatory. Tauri mobile/desktop target.

## Quick Commands
```bash
bun run dev          # Builds SW first, then SST dev
bun run build        # SW + TanStack Router build
bun run build:sw     # Service worker ONLY — MUST run before dev/build or app silently breaks
bun run typecheck    # TanStack Router typegen runs first (auto)
bun run test         # wallet-unit project
bun run test:e2e     # Playwright (19 specs) in tests/specs/
```

## Key Files
- `app/entry.client.tsx` — PWA / Tauri bootstrap + safe area handling
- `app/service-worker.ts` — critical for offline + pairing; `bun run build:sw` emits it
- `app/routes/__root.tsx` — global layout · `app/routes/_wallet/_protected/` — guarded routes
- `app/module/{authentication,wallet,tokens,pairing,recovery,biometrics,notification,history,settings}/` — features
- `app/routeTree.gen.ts` — AUTO-GENERATED, never edit · `tests/vitest-fixtures.ts` — test fixtures
- `src-tauri/` — iOS (TestFlight) + Android (Play Store) shell

## Non-Obvious Patterns
- **SW build is a gate**: forgetting `build:sw` produces a blank app with no useful error.
- **Dual `@/*` alias**: resolves both `./app/*` AND `../../packages/design-system/src/*` — import collisions can be silent.
- **Vanilla Extract migration (active)**: new styles go in `.css.ts` + `Box` sprinkles; `.module.css` is legacy. Both coexist.
- **i18n location surprise**: translations live in `packages/wallet-shared/src/i18n/locales/`; regen types via root `bun run i18n:types`.
- **Tauri detection** drives WebAuthn RP config in `@frak-labs/app-essentials` — tests must set `isTauri` explicitly.
- **Business logic lives elsewhere**: ~90% of auth/session/smart-wallet code is in `@frak-labs/wallet-shared` — don't duplicate here.

## Anti-Patterns
CSS Modules for new code (use Vanilla Extract) · runtime env vars (config is Vite-`define` build-time) · editing `routeTree.gen.ts` · skipping `build:sw`.

## See Also
Parent `/AGENTS.md` · siblings `apps/{business,listener,shopify}/AGENTS.md` · `packages/{wallet-shared,design-system,app-essentials}/AGENTS.md`.
