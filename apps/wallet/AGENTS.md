# apps/wallet — Compass

TanStack Router SPA user wallet. SSR disabled. Module-based. Service worker mandatory. Tauri mobile/desktop target. Plus TWO standalone web entrypoints (`/sharing`, `/install`) that bypass the SPA entirely.

## Quick Commands
```bash
bun run dev              # Builds SW first, then SST dev
bun run build            # SW + SPA build + standalone build (in that order — the SPA pass empties dist/)
bun run build:sw         # Service worker ONLY — MUST run before dev/build or app silently breaks
bun run build:standalone # /sharing + /install only; enforces the eager-JS budget
bun run typecheck        # TanStack Router typegen runs first (auto)
bun run test             # wallet-unit project
bun run test:e2e         # Playwright (13 specs) in tests/specs/
```

## Key Files
- `app/main.tsx` — Tauri bootstrap + safe area handling
- `app/service-worker.ts` — critical for offline + pairing; `bun run build:sw` emits it
- `app/routes/__root.tsx` — global layout · `app/routes/_wallet/_protected/` — guarded routes
- `app/module/{authentication,wallet,tokens,pairing,recovery,biometrics,notification,history,settings}/` — features
- `app/routeTree.gen.ts` — AUTO-GENERATED, never edit · `tests/vitest-fixtures.ts` — test fixtures
- `src-tauri/` — iOS (TestFlight) + Android (Play Store) shell
- `vite.standalone.config.ts` + `{sharing,install}.html` + `app/entry/` — the standalone pages
- `vite.defines.ts` — build-time `define` map SHARED by both builds; edit env wiring here, not in either config

## Non-Obvious Patterns
- **SW build is a gate**: forgetting `build:sw` produces a blank app with no useful error.
- **Dual `@/*` alias**: resolves both `./app/*` AND `../../packages/design-system/src/*` — import collisions can be silent.
- **Vanilla Extract only**: the `.module.css` migration is COMPLETE — zero CSS Modules remain. All styles go in `.css.ts` + `Box` sprinkles.
- **i18n location surprise**: translations live in `packages/wallet-shared/src/i18n/locales/`; regen types via root `bun run i18n:types`.
- **Tauri detection** drives WebAuthn RP config in `@frak-labs/app-essentials` — tests must set `isTauri` explicitly.
- **Business logic lives elsewhere**: ~90% of auth/session/smart-wallet code is in `@frak-labs/wallet-shared` — don't duplicate here.
- **`/sharing` and `/install` have TWO surfaces, ONE implementation.** On the web, nginx serves `sharing.html` / `install.html` from a separate Vite build (preact, no router, no wagmi/viem, no query persistence: ~90 KB gz vs the SPA shell's ~390 KB). Inside Tauri and on any client-side navigation, the SPA routes in `app/routes/{sharing,install}.tsx` render instead. Both render the same `SharingView` / `InstallView`, parameterised by a navigation adapter — put page logic in the view, never in a route or an entry.
- **The standalone build is a SECOND pass over `dist/`**: `emptyOutDir: false`, assets under `dist/standalone/`. In a one-shot `bun run build` it MUST run after the SPA build, which empties `dist/`. Under `--watch` the SPA build empties `dist/` on EVERY rebuild, not just the first, so `vite.config.ts` sets `emptyOutDir: !isWatch` and `dev:built` cleans `dist/` once itself, then runs both watch builds side by side. Both `vite preview` and `vite dev` resolve an extensionless `/sharing` to `sharing.html` before the SPA fallback, so `dev:built` and `dev:sandbox` both serve the real standalone pages.
- **`json.stringify` is off in BOTH Vite configs, on purpose**: `wallet-shared/src/i18n/locales/*/standalone.ts` imports single keys out of `translation.json` by name so the bundler can drop the other ~45 KB. Vite's default turns any JSON over 10 KB into one `JSON.parse("…")` call, which has no named exports at all. The SPA build measured identical either way.
- **Eager-JS budget is a build gate**: `assertEagerBundleBudget` fails `build:standalone` when either page's static-import closure goes over ~105 KB gz. If a change trips it, find what leaked (usually a barrel import pulling viem, or a Radix-backed design-system component) — do not raise the number.
- **Anything reached by a runtime-gated `await import()` needs its own chunk group**: OpenPanel's rrweb session replay (~525 KB of source) is unreachable at runtime but undeletable by any bundler, so a catch-all vendor group swallows it into the eager path. See `openpanel-replay` in `vite.standalone.config.ts`.
- **Preact is standalone-only**: `preact` and `@preact/preset-vite` are wallet devDependencies used exclusively by `vite.standalone.config.ts`. The SPA and every unit test still run React, so a preact-specific regression will NOT be caught by `bun run test`.

## Anti-Patterns
Adding `.module.css` (Vanilla Extract only) · runtime env vars (config is Vite-`define` build-time) · editing `routeTree.gen.ts` · skipping `build:sw` · putting `/sharing` or `/install` logic in a route or an entry instead of its `*View` · barrel-importing `@frak-labs/wallet-shared` from the standalone graph (use the deep `./common/*` exports — the barrel drags viem in) · raising `EAGER_JS_BUDGET_GZIP` to make a build pass.

## See Also
Parent `/AGENTS.md` · siblings `apps/{business,listener,shopify}/AGENTS.md` · `packages/{wallet-shared,design-system,app-essentials}/AGENTS.md`.
