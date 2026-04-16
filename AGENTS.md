# AGENTS.md

**Generated:** 2026-03-19
**Commit:** 50035fdd0
**Branch:** feat/vanilla-extract

## Overview

Frak Wallet monorepo — Web3 referral tracking & rewards infrastructure. TypeScript/React/Bun stack with Account Abstraction (ERC-4337) + WebAuthn authentication. ~1700 TS/TSX source files, ~164k lines.

## Structure

```
frak-wallet/
├── apps/
│   ├── wallet/        # TanStack Router SPA - user wallet (SSR disabled, 14 modules)
│   ├── business/      # TanStack Router SPA - business dashboard (10 modules, largest app)
│   ├── listener/      # Iframe RPC handler for SDK communication (13 modules)
│   └── shopify/       # React Router v7 embedded Shopify app (ONLY non-TanStack app)
├── packages/
│   ├── wallet-shared/ # Shared code for wallet + listener ONLY (201 files, 15 domains)
│   ├── design-system/ # Vanilla Extract design system (28 components, sprinkles, tokens)
│   ├── ui/            # Radix-based component library (22 components) — being replaced by design-system
│   ├── app-essentials/ # Core blockchain + WebAuthn config
│   ├── client/        # Elysia Eden Treaty API client
│   ├── dev-tooling/   # Vite configs, Lightning CSS (centralized for all apps)
│   ├── rpc/           # Published as @frak-labs/frame-connector
│   └── test-foundation/ # Vitest shared setup + mocks (10 projects)
├── sdk/
│   ├── core/          # @frak-labs/core-sdk (NPM ESM/CJS + CDN IIFE as FrakSDK)
│   ├── react/         # @frak-labs/react-sdk (NPM only, 10 hooks)
│   ├── components/    # @frak-labs/components (Preact Web Components, CDN ESM split)
│   └── legacy/        # @frak-labs/nexus-sdk (deprecated, IIFE as NexusSDK)
├── services/
│   └── backend/       # Elysia.js API with DDD (11 domains + orchestration layer)
├── infra/             # SST v3 (AWS) + Pulumi (GCP)
└── example/           # Integration examples (vanilla-js, wallet-ethcc)
```

## Where to Look

| Task | Location | Notes |
|------|----------|-------|
| Wallet features | `apps/wallet/app/module/` | Module-based: auth, tokens, wallet, pairing, recovery |
| Business dashboard | `apps/business/src/module/` | campaigns (29 hooks), merchant (17 hooks), product (29 hooks) |
| SDK iframe comms | `apps/listener/app/module/hooks/` | 14 RPC message handlers |
| Shared wallet logic | `packages/wallet-shared/src/` | 4 Zustand stores, WebAuthn, smart wallet |
| Design system | `packages/design-system/src/` | Vanilla Extract tokens, sprinkles, 28 components |
| UI components (legacy) | `packages/ui/component/` | Radix-based, CSS Modules — migrating to design-system |
| Blockchain config | `packages/app-essentials/src/blockchain/` | ABIs, addresses, transports, Wagmi config |
| Core SDK actions | `sdk/core/src/actions/` | 14 actions: displayModal, sendInteraction, etc. |
| React hooks | `sdk/react/src/hook/` | 10 hooks wrapping core-sdk via TanStack Query |
| Backend domains | `services/backend/src/domain/` | auth, wallet, rewards, campaign, identity, etc. |
| Cross-domain logic | `services/backend/src/orchestration/` | 11+ orchestrators (NEVER in services) |
| Shopify app | `apps/shopify/app/` | React Router v7, Polaris v13, relative imports |
| Shopify services | `apps/shopify/app/services.server/` | 11 server services, Shopify GraphQL |
| Shopify extensions | `apps/shopify/extensions/` | Theme blocks (Liquid) + checkout pixel |
| Vite/CSS config | `packages/dev-tooling/src/vite.ts` | Lightning CSS, centralized browser targets |
| Test mocks | `packages/test-foundation/src/` | Wagmi, WebAuthn, router, DOM mocks |
| Infrastructure | `infra/gcp/` | K8s services, Docker images, secrets |

## Commands

```bash
# Package manager: Bun ONLY (never npm/pnpm/yarn)
bun dev                    # Start SST dev server
bun run build:sdk          # Build all SDK packages (rpc → core → legacy → react → components)
bun run build:infra        # Build infrastructure

# Code quality
bun run lint               # Biome lint
bun run format             # Biome format (4-space, double quotes)
bun run typecheck          # TypeScript check all packages
bun run knip               # Dead code elimination

# Testing - CRITICAL: use "bun run test", NOT "bun test"
bun run test               # All 10 Vitest projects in parallel
bun run test --project wallet-unit  # Single project
bun run test:coverage      # With coverage (40% target)
cd apps/wallet && bun run test:e2e  # Playwright E2E (19 specs)

# Deployment
bun run deploy             # AWS dev
bun run deploy:prod        # AWS prod
bun run deploy-gcp:staging # GCP staging (backend)
bun run deploy-gcp:prod    # GCP prod (all production apps on GKE)
```

## Quality Gates (Mandatory)

Before completing any task, **always run**:
```bash
bun run format && bun run lint && bun run typecheck && bun run test
```
All four must pass. Do not commit or report completion with failures.

## Conventions

### TypeScript
- `type` over `interface`, no enums (use maps)
- Absolute imports: `@/...` paths (exception: Shopify uses relative)
- No `as any`, `@ts-ignore`, `@ts-expect-error`, `!` non-null assertion
- `useImportType` / `useExportType` enforced by Biome

### Styling
- **Wallet app**: Migrating from CSS Modules → **Vanilla Extract** (`@frak-labs/design-system`)
  - New styles: `.css.ts` files using `@vanilla-extract/css` + `@vanilla-extract/sprinkles`
  - Use `Box` component with sprinkles props for layout, `vars` for theme tokens
  - Semantic tokens: `vars.text.*`, `vars.surface.*`, `vars.border.*`, `vars.icon.*`
  - Responsive: `{ mobile: ..., tablet: ..., desktop: ... }` via sprinkles
  - Light/dark themes via `[data-theme='dark']` selector
- **Other apps**: CSS Modules + Lightning CSS (unchanged)
- NO Tailwind anywhere
- Lightning CSS via `packages/dev-tooling/src/vite.ts` (business, listener)
- Browser targets: Chrome 100+, Safari 14+, Firefox 91+, Edge 100+

### Formatting (Biome)
- 4-space indent, double quotes, semicolons, LF
- ES5 trailing commas
- Cognitive complexity limit: 16

### Patterns
- Functional programming, avoid classes
- Early returns, async/await (no callbacks)
- Event handlers: `handle` prefix (`handleClick`)
- Named exports only (no default exports)

### State Management
- Zustand everywhere with persist middleware
- **Always use individual selectors**: `store((s) => s.value)`
- Never subscribe to entire store

### Commit Messages
- **Always prefix with emoji** matching the change type
- Concise, no conventional commit prefix (`fix:`, `feat:`) — emoji replaces it

| Emoji | Usage |
|-------|-------|
| ✨ | New feature |
| 🐛 | Bug fix |
| ♻️ | Refactor |
| 🔧 | Config / tooling |
| ⬆️ | Dependency / version bump |
| 🗑️ | Remove code / deprecation |
| 🎨 | UI / styling |
| ⚡ | Performance |
| 🧪 | Tests |
| 📝 | Documentation |

## Anti-Patterns

| Forbidden | Reason |
|-----------|--------|
| `npm`, `pnpm`, `yarn` | Bun only |
| `bun test` | Use `bun run test` (Vitest workspace) |
| Tailwind | Vanilla Extract (wallet) / CSS Modules (other apps) |
| `try/catch` everywhere | Only for abstraction/translation |
| Classes | Functional patterns preferred |
| `as any`, `@ts-ignore`, `!` | Type safety is non-negotiable |
| Entire store subscription | Performance killer |
| `interface` | Use `type` (interface only for declaration merging) |
| Cross-domain service imports | Use orchestration layer (backend) |
| `<a>` tags in Shopify | Use `Link` — embedded app loses session |

## Testing

- **10 Vitest projects**: wallet, listener, business, shopify, wallet-shared, ui, core-sdk, react-sdk, components, backend
- **Frontend**: jsdom, mock Wagmi/WebAuthn/TanStack Query, concurrent
- **Backend**: Node environment, sequential (stateful mocks)
- **Shopify**: jsdom, co-located `*.test.ts`, React Router v7
- **E2E**: Playwright (19 specs) in `apps/wallet/tests/specs/`
- **Mocks**: Centralized in `packages/test-foundation/src/`
- **Fixtures**: `test.extend()` with auto-reset stores per test
- **Naming**: "should [behavior] when [condition]"
- **Coverage**: V8, 40% threshold, disabled locally (CI-only)

## SDK Build (tsdown)

All SDK packages use tsdown (Rolldown-powered). Build is sequential:

`rpc → core → legacy → react → components`

| Package | NPM Output | CDN Output | Global |
|---------|------------|------------|--------|
| frame-connector | ESM+CJS → `dist/` | — | — |
| core | ESM+CJS → `dist/` | IIFE → `cdn/` | `FrakSDK` |
| react | ESM+CJS → `dist/` | — | — |
| components | ESM → `dist/` | ESM split → `cdn/` | — |
| legacy | — | IIFE → `dist/bundle/` | `NexusSDK` |

- **Development exports**: `"development"` condition → source files for fast monorepo dev
- **CDN bundles**: `noExternal: [/.*/]` — fully self-contained
- **Linked versions**: frame-connector, core-sdk, react-sdk (Changesets)

## Infrastructure

- **AWS (SST v3)**: Static sites (admin, examples), dev deployments
- **GCP (Pulumi)**: Production apps on GKE (backend, wallet, business, listener)
- **Stages**: `$dev` (local), dev, prod (AWS), gcp-staging, gcp-production (GCP)
- **Docker**: `Dockerfile.base` pre-builds SDK (shared layer), app Dockerfiles extend it
- **Frontend secrets**: BuildKit `--mount=type=secret` (build-time only, never in runtime)
- **Backend secrets**: K8s env vars from GCP Secret Manager
- **DB migrations**: `KubernetesJob` runs before backend deploy
- **Listener routing**: Served at `/listener` path on wallet ingress (not standalone)

## CI/CD

- **deploy.yml**: Path-based triggers, `main` → prod, `dev` → staging
- **release.yml**: Changesets → npm publish + jsDelivr cache purge
- **beta-release.yml**: SDK changes on `dev` → beta publish with content hash
- **tauri-mobile-release.yml**: Manual trigger → iOS (TestFlight) + Android (Play Store)

## Hierarchical AGENTS.md

Domain-specific context per directory (21 sub-files):

| Area | Files |
|------|-------|
| Apps | `apps/{wallet,business,listener,shopify}/AGENTS.md` |
| Shopify sub | `apps/shopify/app/{services.server,components,hooks,routes}/AGENTS.md`, `apps/shopify/extensions/AGENTS.md` |
| SDK | `sdk/AGENTS.md`, `sdk/{core,react,components}/AGENTS.md` |
| Packages | `packages/AGENTS.md`, `packages/{wallet-shared,design-system,ui,app-essentials,test-foundation}/AGENTS.md` |
| Backend | `services/backend/AGENTS.md` |
| Infra | `infra/AGENTS.md` |

## Notes

- Service worker required before wallet dev/build: `bun run build:sw`
- TanStack Router typegen before typecheck: runs automatically
- Drizzle schemas: `src/domain/*/db/schema.ts` pattern
- Vite aliased to `rolldown-vite` (v8) — Rust-based bundler
- `@wagmi/connectors` stubbed in resolutions (avoids MetaMask SDK bloat)
- Shopify app uses relative imports (exception to `@/...` convention)
- Backend uses `@backend-utils`, `@backend-infrastructure/*`, `@backend-domain/*` path aliases
- **Vanilla Extract migration** (in progress): Wallet app migrating `.module.css` → `.css.ts` files using `@frak-labs/design-system`. `packages/ui` will be superseded by `packages/design-system` once migration completes.
- Wallet app tsconfig aliases `@/*` to both `./app/*` and `../../packages/design-system/src/*` (dual resolution for design system imports)
