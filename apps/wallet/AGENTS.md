# apps/wallet — Compass

TanStack Router SPA user wallet. SSR disabled. Module-based. Service worker mandatory. Tauri mobile/desktop target. Plus TWO standalone web entrypoints (`/sharing`, `/install`) that bypass the SPA entirely.

## Quick Commands
```bash
bun run dev              # Builds SW first, then SST dev
bun run build            # SW + SPA build + standalone build (in that order — the SPA pass empties dist/)
bun run build:sw         # Service worker ONLY — MUST run before dev/build or app silently breaks
bun run build:standalone # /sharing + /install only; enforces the eager-JS budget
bun run typecheck        # bare `tsc --noEmit`; needs `generate:routes` first if routeTree.gen.ts is missing
bun run test             # wallet-unit project
bun run test:e2e         # Playwright specs in tests/specs/
```

## Key Files
- `app/main.tsx` — Tauri bootstrap + safe area handling
- `app/service-worker.ts` — critical for offline + pairing; `bun run build:sw` emits it
- `app/routes/__root.tsx` — global layout · `app/routes/_wallet/_protected/` — guarded routes
- `app/module/` — one directory per feature
- `app/routeTree.gen.ts` — AUTO-GENERATED, never edit · `tests/vitest-fixtures.ts` — test fixtures
- `src-tauri/` — iOS (TestFlight) + Android (Play Store) shell
- `vite.standalone.config.ts` + `{sharing,install}.html` + `app/entry/` — the standalone pages
- `vite.defines.ts` — build-time `define` map SHARED by both builds; edit env wiring here, not in either config

## Non-Obvious Patterns
- **SW build is a gate**: forgetting `build:sw` produces a blank app with no useful error.
- **Dual `@/*` alias**: resolves both `./app/*` AND `../../packages/design-system/src/*` — import collisions can be silent.
- **i18n location surprise**: translations live in `packages/wallet-shared/src/i18n/locales/`; regen types via root `bun run i18n:types`.
- **Tauri detection** drives WebAuthn RP config in `@frak-labs/app-essentials` — tests must set `isTauri` explicitly.
- **OTA patches ONE released version, never "latest".** CrabNebula's `tauri-plugin-ota-updater` swaps `dist/` at runtime, so a frontend fix reaches users without store review — but the bundle is only valid for the binary it was built against: `vite.config.ts` bakes `__IS_IOS__`/`__IS_ANDROID__` in, `vite.defines.ts` bakes `BACKEND_URL` in, and the `invoke` surface is only satisfied by that binary's Rust + `capabilities/`. So the channel is `{stage}-{platform}-{version}`, computed once as `__OTA_CHANNEL__` in `vite.defines.ts` (from `walletPackage.version`, NOT `appVersion` — that collapses to `COMMIT_HASH` on web deploys) and passed to `setChannel()` by `app/module/version/utils/otaUpdater.ts`. Ship with `.github/workflows/wallet-ota-hotfix.yml` from a branch cut off the `app-{version}` tag; its guard refuses to publish if `apps/wallet/src-tauri` differs from that tag, which is what makes "is this OTA-safe?" exact rather than a guess.
- **The release workflow deliberately does NOT publish an OTA baseline.** Assets identical to the embedded ones would make every fresh install download the whole archive on first launch, for zero change.
- **The OTA plugin must never touch the network at boot: keep `"updateOnStartup": false`.** With it on, `setup()` runs `block_on(check_for_updates())` before the webview exists; 2.0.8 had no timeout and left a white screen forever on a network that accepts the connection and never answers (measured 2026-10-08). The key is `updateOnStartup` as the code reads it; the 2.1.0 README's `checkOnStart` is silently ignored. The only check is `stageOtaUpdate()`, called once per launch from `main.tsx` after the first render — never as a persisted query, which would cache `up_to_date` for the binary's lifetime. Never publish to `unset` or the default `over-the-air` channel.
- **`apply()` is live, not next-launch.** It replaces the asset map the running webview reads from: code already loaded keeps running, later lazy chunks come from the new bundle (or the embedded one), and the full switch happens on the next launch. A second OTA for the same version drops the first one's chunks, so a session that started on OTA #1 can fail to load a lazy route — prefer one OTA per version. Nothing reloads the webview on purpose: that would kill an in-flight signing or recovery flow.
- **The plugin serves any cached bundle newer than the binary's build date, whatever its version.** `src-tauri/src/ota_cache.rs` deletes the plugin's cache files whenever the binary version changes, and must stay registered before `ota_plugin` (setups run in registration order). Without it, a hotfix for N published while N+1 is in review boots on N+1 after the store update.
- **No inline `<script>` in `index.html`.** The Tauri CSP has no `'unsafe-inline'`; the embedded HTML gets compile-time nonces, an OTA bundle's does not. Early-boot code goes in `public/boot.js`.
- **Business logic lives elsewhere**: ~90% of auth/session/smart-wallet code is in `@frak-labs/wallet-shared` — don't duplicate here.
- **`/sharing` and `/install` have TWO surfaces, ONE implementation.** On the web, nginx serves `sharing.html` / `install.html` from a separate Vite build (preact, no router, no wagmi/viem, no query persistence: ~90 KB gz vs the SPA shell's ~390 KB). Inside Tauri and on any client-side navigation, the SPA routes in `app/routes/{sharing,install}.tsx` render instead. Both render the same `SharingView` / `InstallView`, parameterised by a navigation adapter — put page logic in the view, never in a route or an entry.
- **`/r/<CODE>` (short referral QR) exists in two places, and there is no SPA route for it**: on the web it is an nginx `302` to `/install?ref=`; with the app installed, the OS hands the URL straight to the app (AASA `/*`, Android `pathPattern /.*`), so the `r` resolver in `app/utils/deepLink.ts` handles it. Change one, change the other. Both accept any case, which lets the QR stay fully uppercase (alphanumeric mode).
- **`/i` (short install link, ambassador QR) is `/install` under another name, in two places**: nginx `location = /i` serves `install.html`, and the `i` resolver in `app/utils/deepLink.ts` routes to `/install` (plus a `vite.config.ts` rewrite so `dev`/`preview` serve it too). It carries compact 22-char `m`/`a` (expanded by `parseInstallSearch`) and may omit `a`, which `resolveInstallAnonymousId` derives from the proof.
- **The standalone build is a SECOND pass over `dist/`**: `emptyOutDir: false`, assets under `dist/standalone/`. In a one-shot `bun run build` it MUST run after the SPA build, which empties `dist/`. Under `--watch` the SPA build empties `dist/` on EVERY rebuild, not just the first, so `vite.config.ts` sets `emptyOutDir: !isWatch` and `dev:built` cleans `dist/` once itself, then runs both watch builds side by side. Both `vite preview` and `vite dev` resolve an extensionless `/sharing` to `sharing.html` before the SPA fallback, so `dev:built` and `dev:sandbox` both serve the real standalone pages.
- **`json.stringify` is off in BOTH Vite configs, on purpose**: `wallet-shared/src/i18n/locales/*/standalone.ts` imports single keys out of `translation.json` by name so the bundler can drop the other ~45 KB. Vite's default turns any JSON over 10 KB into one `JSON.parse("…")` call, which has no named exports at all. The SPA build measured identical either way.
- **Eager-JS budget is a build gate**: `assertEagerBundleBudget` fails `build:standalone` when either page's static-import closure goes over ~105 KB gz. If a change trips it, find what leaked (usually a barrel import pulling viem, or a Radix-backed design-system component) — do not raise the number.
- **Anything reached by a runtime-gated `await import()` needs its own chunk group**: OpenPanel's rrweb session replay (~525 KB of source) is unreachable at runtime but undeletable by any bundler, so a catch-all vendor group swallows it into the eager path. See `openpanel-replay` in `vite.standalone.config.ts`.
- **Preact is standalone-only**: `preact` and `@preact/preset-vite` are wallet devDependencies used exclusively by `vite.standalone.config.ts`. The SPA and every unit test still run React, so a preact-specific regression will NOT be caught by `bun run test`.

## Anti-Patterns
Adding `.module.css` (Vanilla Extract only) · runtime env vars (config is Vite-`define` build-time) · editing `routeTree.gen.ts` · skipping `build:sw` · putting `/sharing` or `/install` logic in a route or an entry instead of its `*View` · barrel-importing `@frak-labs/wallet-shared` from the standalone graph (use the deep `./common/*` exports — the barrel drags viem in) · raising `EAGER_JS_BUDGET_GZIP` to make a build pass.

## See Also
Parent `/AGENTS.md` · siblings `apps/{business,listener,shopify}/AGENTS.md` · `packages/{wallet-shared,design-system,app-essentials}/AGENTS.md`.
