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
bun run --filter '*/native-*' lint    # Kotlin + Swift — NOT covered by the gate above
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
| Test mocks/fixtures | `packages/test-foundation/src/` |
| Native SDK harnesses | `example/native-{android,ios}/` (Kotlin/Compose + Swift/SwiftUI) |
| Infra (AWS/GCP) | `infra/` · `sst.config.ts` · `infra/gcp/*.ts` |

## Non-Obvious Patterns (Tribal Knowledge)

- **Service worker gate**: `apps/wallet` requires `bun run build:sw` BEFORE `dev`/`build` — silent load failure otherwise.
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
- **The quality gate does NOT cover native**: biome cannot parse Kotlin or Swift, so `example/native-{android,ios}` (and `sdk/{android,ios}`) are excluded in `biome.json`. Native has its own equivalents — ktlint via the Gradle plugin, `swift format` from the Xcode toolchain — run per app (`bun run --cwd example/native-ios lint`) or across both with `bun run --filter '*/native-*' lint`. Neither needs installing. There is no separate native typecheck: `assembleDebug` and `swift build` under Swift 6 strict concurrency *are* it.
- **Native example apps are the test harness, not a demo**: a native SDK cannot run without an app hosting it — there is no equivalent of opening a page against `sdk/core`. They consume the SDK through its public API only. Both `FrakSDK` files are type-only stubs today (every call logs and returns); the real `sdk/android` and `sdk/ios` do not exist yet.
- **Commit style**: Conventional Commits (`type(scope): subject`) — e.g. `feat`, `fix`, `refactor`, `chore`, `build`, `style`, `perf`, `test`, `docs`.
- **Vite is aliased to `rolldown-vite`** (Rust); `@wagmi/connectors` stubbed in resolutions to avoid MetaMask SDK bloat.
- **Stages matter**: `$dev` (local), `dev` / `prod` (AWS), `gcp-staging` / `gcp-production` (GCP GKE, all prod apps). Migration `KubernetesJob` MUST finish before backend `KubernetesService` deploys.
- **Listener is not standalone**: served at `/listener` path on wallet ingress.
- **Frontend secrets = build-time only** via BuildKit `--mount=type=secret` (never runtime). Backend secrets = K8s env vars from GCP Secret Manager.

## Anti-Patterns (Forbidden Here)

`npm`/`pnpm`/`yarn` · `bun test` · Tailwind · Vanilla Extract `globalStyle` (use scoped `style()`) · `try/catch` without translation purpose · classes · `as any`/`@ts-ignore`/`!` · entire-store Zustand subscriptions · `interface` (except declaration merging) · cross-domain service imports · `<a>` in Shopify · stage `"prod"` in Shopify/SST.

## See Also

Root children: `apps/{business,listener,shopify,wallet}/AGENTS.md` families · `packages/AGENTS.md` · `sdk/AGENTS.md` · `services/backend/AGENTS.md` · `infra/AGENTS.md` · `plugins/{magento,prestashop,wordpress}/AGENTS.md`.
