# AGENTS.md — Root Compass

**Generated:** 2026-04-17 · **Commit:** 07d03a811 · **Branch:** feat/wordpress-review
**Format:** Meta-style compass (non-obvious knowledge only). See children for deep context.

## Overview

Frak Wallet monorepo — Web3 referral tracking & rewards. TS/React/Bun + ERC-4337 + WebAuthn. Config-as-code across 4 apps, 8 packages, 3 plugins, 3 services, split AWS/GCP infra.

## Quick Commands

```bash
bun install                          # Bun ONLY — npm/pnpm/yarn forbidden
bun run build:sdk                    # Sequence: rpc → core → legacy → react → components
bun run test                         # NEVER `bun test` — use `bun run test` (Vitest workspace)
bun run format && bun run lint && bun run typecheck && bun run test  # Quality gate (all four mandatory pre-commit)
bun run lint:comments                # Comment budget on Kotlin/Swift — already inside `bun run lint`
bun run --filter '*/native-*' lint    # ktlint + swift format — NOT covered by the gate above
bun run deploy / deploy:prod         # AWS SST · bun run deploy-gcp:{staging,prod}  # GCP Pulumi
```

## Where to Look

| Task | Location |
|------|----------|
| User wallet UI | `apps/wallet/app/module/` (13 modules, SSR disabled) |
| Merchant dashboard | `apps/business/src/module/` (largest app, 345 files) |
| SDK iframe RPC handlers | `apps/listener/app/module/hooks/` (14 handlers) |
| Shopify embedded app | `apps/shopify/app/` (ONLY React Router v7, relative imports) |
| Backend domains | `services/backend/src/domain/` · cross-domain → `src/orchestration/` |
| SDK actions | `sdk/core/src/actions/` · React hooks → `sdk/react/src/hook/` |
| Design tokens / Box | `packages/design-system/` |
| Blockchain config/ABIs | `packages/app-essentials/src/blockchain/` |
| Shared wallet state | `packages/wallet-shared/` (wallet+listener ONLY) |
| Standalone sharing/install pages | `apps/wallet/app/entry/` + `apps/wallet/vite.standalone.config.ts` |
| Test mocks/fixtures | `packages/test-foundation/src/` |
| Native SDK | `sdk/android/` (Gradle, `id.frak.sdk:core` + `:ui`) · `sdk/ios/` (SwiftPM, `FrakSDK` + `FrakSDKUI`) |
| Native SDK harnesses | `example/native-{android,ios}/` (Kotlin/Compose + Swift/SwiftUI) |
| Infra (AWS/GCP) | `infra/` · `sst.config.ts` · `infra/gcp/*.ts` |

## Non-Obvious Patterns (Tribal Knowledge)

- **Service worker gate**: `apps/wallet` requires `bun run build:sw` BEFORE `dev`/`build` — silent load failure otherwise.
- **`/sharing` + `/install` are standalone web entrypoints**: `apps/wallet` ships THREE builds, not one — the SPA, the service worker, and `vite.standalone.config.ts`, which emits `sharing.html` / `install.html` (preact, no router, no blockchain: ~90 KB gz against the SPA shell's ~390 KB) because both pages are opened as full-page loads by the web/iOS/Android SDKs. nginx routes those two paths there; Tauri and client-side navigations keep using the SPA routes. Same `SharingView` / `InstallView` on both surfaces — a build gate (`assertEagerBundleBudget`) fails the build if the light bundle regresses.
- **Wallet `@/*` dual resolution**: resolves to both `./app/*` AND `../../packages/design-system/src/*` (tsconfig).
- **Vanilla Extract everywhere**: all styles use `.css.ts` (`style()`/`keyframes()`) + `Box` sprinkles. No CSS Modules remain — do not add `.module.css`.
- **No `globalStyle` (monorepo-wide)**: prefer scoped `style()` classes. To style a child/variant, put the same class on both elements (or add a dedicated class) instead of a `${parent} *` descendant selector.
- **`wallet-shared` scope rule**: imports FORBIDDEN in `business`/`backend`/`shopify`. Wallet+listener only.
- **Orchestration rule (backend)**: `service → service` and `service → orchestrator` FORBIDDEN. Cross-domain logic lives only in `src/orchestration/`. Access singletons via `{Domain}Context.services.*`, never `new Service()`.
- **SDK `development` export condition**: monorepo apps consume SDK source directly — rebuild only needed for published artifacts.
- **CDN bundles are `noExternal: [/.*/]`**: fully self-contained; bumping a dep bloats CDN size.
- **Zustand individual selectors mandatory**: `store((s) => s.x)`. Destructuring whole store = re-render storm (business app is most sensitive).
- **Shopify non-obvious**: no `<a>` / no `react-router` `redirect` in auth routes (loses session); stage literal `"prod"` is FORBIDDEN — use `"production"`; README mentions Prisma/SQLite but project uses Drizzle/Postgres.
- **Bun bin trap**: `bun test` bypasses Vitest and runs Bun's own runner — always use `bun run test`.
- **Dual TypeScript (intentional)**: `typescript@6` stays alongside `@typescript/native` (TS 7): typedoc, tsdown/rolldown-plugin-dts, and tsserver (editor) peer on TS ≤6; only `typecheck` scripts use the TS 7 `tsc`. Do NOT "clean up" the TS 6 dep.
- **Biome config**: 4-space indent, double quotes, ES5 trailing commas, cognitive complexity ≤16 everywhere except `packages/rpc` (own `biome.json`, rule off) and `packages/design-system/src/components/charts/**` (root override, rule off). `type` over `interface`, no enums, no `as any`/`@ts-ignore`/`!`.
- **The quality gate does NOT cover native**: biome cannot parse Kotlin or Swift, so `example/native-{android,ios}` (and `sdk/{android,ios}`) are excluded in `biome.json`. Native has its own equivalents — ktlint via the Gradle plugin, `swift format` from the Xcode toolchain — run per app (`bun run --cwd example/native-ios lint`) or across both with `bun run --filter '*/native-*' lint`. Neither needs installing. There is no separate native typecheck: Gradle assembly (`assembleDebug` in the harnesses, `assembleRelease` in `sdk/android`) and `swift build` under Swift 6 strict concurrency *are* it.
- **Native example apps are the test harness, not a demo**: a native SDK cannot run without an app hosting it. Both harnesses drive the real client through its public API only — Android via a Gradle composite build, iOS via a SwiftPM path dependency.
- **`sdk/{android,ios}` implement the MVP surface**: two artifacts each (core is UI-free, UI carries the web view) covering identity + proof signing, the FrakContext v2 codec, tracking over a durable queue, inbound `fCtx`, the sharing sheet and the install handoff. Android has been device-tested throughout development and iOS since 2026-08-12 — but always against `example/native-{android,ios}`, in a debug build, on one screen, which cannot catch what the harness itself gets wrong, what only R8 does, or what only a multi-destination `NavHost` triggers. CI (`.github/workflows/apps.yaml`) covers both SDKs on every `dev`/`main` push and PR touching them — Android now runs the full `check` (ktlint, `assembleRelease`, JVM tests, the ABI gate, Android Lint, version drift — the dex budget was retired in `32836c217` for measuring unminified output; the harness's `release` variant is minified so R8 is reproducible), but that is still compile-and-JVM/host-test coverage only, no emulator, no simulator. **The Android ABI gate is now ratified**: `frak-sdk/api/frak-sdk.api` and `frak-sdk-ui/api/frak-sdk-ui.api` are committed, `apiCheck` passes and runs in CI, and `check` is green — change a public signature and it goes red until you rerun `bun run --cwd sdk/android apiDump` (JDK 17 + `ANDROID_HOME`) and review the diff. iOS has no ABI gate and cannot easily have one. **Still no publish path, but no longer a broken one**: A6 is closed — `publishToMavenLocal` succeeds for both modules — and nothing has been published or consumed as a published artifact. Plan: `docs/plans/native-sdk/`, and `09-android-api-surface.md` for the Android surface that gate freezes.
- **`sdk/ios` now declares Swift 6 in `Package.swift`**: the manifest is tools-version 6.0 with `.swiftLanguageMode(.v6)` on all four targets, so a merchant's own build gets the same strict concurrency CI does — it used to be tools-version 5.9 with `-swift-version 6` passed only from `scripts/run.sh`, which CI called and a merchant never did. The cost is a hard Xcode 16 floor for anyone resolving the package; `.unsafeFlags` is not an alternative, SwiftPM forbids it on a package resolved as a dependency. Tests use Swift Testing, not XCTest — the XCTest overlay cannot link at an iOS-simulator triple from SwiftPM.
- **Native SDK versioning is deliberately outside Changesets**: `id.frak.sdk:core` and `FrakSDK` version independently — a merchant's binary freezes at store submission, so a JS-style patch cadence is meaningless. Both `package.json` files are `private` and in `.changeset/config.json` `ignore`; they exist only to dispatch to `scripts/run.sh`.
- **Comments are on a budget, and it is now enforced (`bun run lint:comments`)**: this rule has decayed twice — once before `f7e69f4` (unreachable from `dev` now; it took 6826 comment lines to 2275) and again across the native SDK work, which put ~600 lines back. So it stopped being prose: `scripts/check-comments.ts` runs inside `bun run lint`, and the rules below are what it checks on every `.kt`/`.swift` file. Point it at paths to scope it (`bun run lint:comments -- services/backend/src`); TS is checkable that way but not gated, since biome owns that tree.
  - **Ceiling: 5 lines of comment text per block** — delimiters (`/**`, `*/`) and blank `*` separators do not count, and a `- Parameters:`/`@param`/`@return` tail is exempt. A block that wants more is telling you the code needs a name, not a paragraph. Public surface → 1–2 sentence summary plus those tags. `internal`/`private` → one line, and only for a trap the next reader would otherwise "fix". Statement inside a body → one line.
  - **Never longer than the code it sits on** (measured against the whole braced body, so a type is measured against the type). 9 lines of doc on a 1-line `let` is the exact shape that got deleted last time.
  - **Never the history**: `used to`, `previously`, `no longer`, `the old X`, `we tried`, `originally`, "record of what was checked", "rejected alternatives, for completeness" — all rejected by the linter, all of it belongs in the commit message, the PR body, or `docs/plans/**`. A source file is where rationale goes to never be deleted. Cross-platform comparisons ("Android does X, we do Y") are the same thing and go the same place.
  - **Never the mechanism**: comment the trap (an invariant the compiler cannot state, a lock held one layer up, a wire-format quirk), not what the next five lines plainly do.
  - **Tests**: the test name is the documentation. No doc block on a `@Test`/`func test…` beyond one line, and never a note on what the test deliberately does *not* cover — delete it or make it a case.
  - **Baseline, not amnesty**: `scripts/comment-budget-baseline.json` holds the 101 findings that predate the gate, per file. A file may only ever get better — add one and the build goes red. After paying some down, run `bun run lint:comments -- --update-baseline` and commit the smaller numbers.
- **Commit style**: Conventional Commits (`type(scope): subject`) — e.g. `feat`, `fix`, `refactor`, `chore`, `build`, `style`, `perf`, `test`, `docs`.
- **Vite is aliased to `rolldown-vite`** (Rust); `@wagmi/connectors` stubbed in resolutions to avoid MetaMask SDK bloat.
- **Stages matter**: `$dev` (local), `dev` / `prod` (AWS), `gcp-staging` / `gcp-production` (GCP GKE, all prod apps). Migration `KubernetesJob` MUST finish before backend `KubernetesService` deploys.
- **Listener is not standalone**: served at `/listener` path on wallet ingress.
- **Frontend secrets = build-time only** via BuildKit `--mount=type=secret` (never runtime). Backend secrets = K8s env vars from GCP Secret Manager.

## Anti-Patterns (Forbidden Here)

`npm`/`pnpm`/`yarn` · `bun test` · Tailwind · Vanilla Extract `globalStyle` (use scoped `style()`) · `try/catch` without translation purpose · classes · `as any`/`@ts-ignore`/`!` · entire-store Zustand subscriptions · `interface` (except declaration merging) · cross-domain service imports · `<a>` in Shopify · stage `"prod"` in Shopify/SST · comment blocks over 5 lines · comment blocks longer than the code they sit on · doc blocks on `@Test`/`func test…` · comments narrating history, rejected alternatives, or the other platform's design (the last four are `bun run lint:comments`, and they are the ones that keep regressing).

## See Also

Root children: `apps/{business,listener,shopify,wallet}/AGENTS.md` families · `packages/AGENTS.md` · `sdk/AGENTS.md` · `services/backend/AGENTS.md` · `infra/AGENTS.md` · `plugins/{magento,prestashop,wordpress}/AGENTS.md`.
