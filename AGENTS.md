# AGENTS.md

**Generated:** 2026-02-18  
**Commit:** bbb5bee29  
**Branch:** feat/shopify-migration

## Overview

Frak Wallet monorepo - Web3 referral tracking & rewards infrastructure. TypeScript/React/Bun stack with Account Abstraction (ERC-4337) + WebAuthn authentication.

## Structure

```
frak-wallet/
├── apps/
│   ├── wallet/        # TanStack Router SPA - user wallet (SSR disabled)
│   ├── business/      # TanStack Router SPA - business dashboard
│   ├── listener/      # Iframe RPC handler for SDK communication
│   ├── dashboard-admin/  # Admin interface
│   └── shopify/       # React Router v7 embedded Shopify app
├── packages/
│   ├── wallet-shared/ # Shared code for wallet + listener ONLY
│   ├── ui/            # Radix-based component library
│   ├── app-essentials/ # Core blockchain + WebAuthn config
│   ├── client/        # Elysia Eden Treaty API client
│   ├── dev-tooling/   # Vite configs, Lightning CSS
│   ├── rpc/           # Published as @frak-labs/frame-connector
│   └── test-foundation/ # Vitest shared setup + mocks
├── sdk/
│   ├── core/          # @frak-labs/core-sdk (NPM + CDN IIFE)
│   ├── react/         # @frak-labs/react-sdk (NPM only)
│   ├── components/    # @frak-labs/components (Preact Web Components)
│   └── legacy/        # @frak-labs/nexus-sdk (backward compat)
├── services/
│   └── backend/       # Elysia.js API with DDD structure
├── infra/             # SST v3 (AWS) + Pulumi (GCP)
└── example/           # Integration examples
```

## Where to Look

| Task | Location | Notes |
|------|----------|-------|
| Wallet features | `apps/wallet/app/module/` | Module-based architecture |
| Business dashboard | `apps/business/src/module/` | SPA, TanStack Router |
| SDK iframe communication | `apps/listener/app/module/hooks/` | RPC message handlers |
| Shared wallet logic | `packages/wallet-shared/src/` | Stores, auth, blockchain |
| UI components | `packages/ui/component/` | Radix-based, CSS Modules |
| Core SDK actions | `sdk/core/src/actions/` | Blockchain interactions |
| React hooks | `sdk/react/src/hook/` | 9 hooks + providers |
| Backend domains | `services/backend/src/domain/` | auth, wallet, oracle, etc. |
| Shopify app | `apps/shopify/app/` | React Router v7, Polaris v13 |
| Shopify services | `apps/shopify/app/services.server/` | Shopify GraphQL, merchant resolution |
| Shopify extensions | `apps/shopify/extensions/` | Theme blocks, checkout pixel |
| Vite/CSS config | `packages/dev-tooling/src/vite.ts` | Lightning CSS central config |
| Test mocks | `packages/test-foundation/src/` | Wagmi, WebAuthn, router mocks |

## Commands

```bash
# Package manager: Bun ONLY (never npm/pnpm/yarn)
bun dev                    # Start SST dev server
bun run build:sdk          # Build all SDK packages
bun run build:infra        # Build infrastructure

# Code quality
bun run lint               # Biome lint
bun run format             # Biome format (4-space, double quotes)
bun run typecheck          # TypeScript check all packages

# Testing - CRITICAL: use "bun run test", NOT "bun test"
bun run test               # All 11 Vitest projects in parallel
bun run test --project wallet-unit  # Single project
bun run test:coverage      # With coverage (40% target)
cd apps/wallet && bun run test:e2e  # Playwright E2E

# Deployment
bun run deploy             # AWS dev
bun run deploy:prod        # AWS prod
bun run deploy-gcp:staging # GCP staging
bun run deploy-gcp:prod    # GCP prod (all production apps)
```

## Conventions

### TypeScript
- `type` over `interface`, no enums (use maps)
- Absolute imports: `@/...` paths
- No `as any`, `@ts-ignore`, `@ts-expect-error`

### Styling
- **CSS Modules only** - NO Tailwind
- Lightning CSS (100x faster than PostCSS)
- BEM naming: `block__element--modifier`
- Browser targets: Chrome 100+, Safari 14+, Firefox 91+, Edge 100+

### Formatting (Biome)
- 4-space indent, double quotes, semicolons
- ES5 trailing commas
- Cognitive complexity limit: 16

### Patterns
- Functional programming, avoid classes
- Early returns, async/await (no callbacks)
- Event handlers: `handle` prefix (`handleClick`)
- Named exports for components

### State Management
- Zustand everywhere with persist middleware
- **Always use individual selectors**: `store((s) => s.value)`
- Never subscribe to entire store

### Commit Messages
- **Always prefix with emoji** matching the change type
- Concise, no conventional commit prefix (`fix:`, `feat:`) — emoji replaces it
- Match existing patterns from `git log`

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
| Tailwind | CSS Modules + Lightning CSS |
| `try/catch` everywhere | Only for abstraction/translation |
| Classes | Functional patterns preferred |
| Type suppression | No `as any`, `@ts-ignore` |
| Entire store subscription | Performance killer |

## Testing

- **11 Vitest projects**: wallet, listener, business, wallet-shared, ui, core-sdk, react-sdk, components, shopify, backend + others
- **Frontend**: jsdom environment, mock Wagmi/WebAuthn/TanStack Query
- **Backend**: Node environment, mock Viem/Drizzle/Bun runtime
- **Shopify**: Node environment, co-located `*.test.ts` files
- **E2E**: Playwright (19 specs) in `apps/wallet/tests/specs/`
- **Mocks**: Centralized in `packages/test-foundation/src/`
- **Naming**: "should [behavior] when [condition]"

## SDK Build (tsdown)

All SDK packages use tsdown (Rolldown-powered):

| Package | NPM Output | CDN Output | Global |
|---------|------------|------------|--------|
| core | ESM+CJS → `dist/` | IIFE → `cdn/` | `FrakSDK` |
| react | ESM+CJS → `dist/` | - | - |
| components | ESM → `dist/` | ESM split → `cdn/` | - |
| legacy | - | IIFE → `dist/bundle/` | `NexusSDK` |

Build order: `rpc → core → legacy → react → components`

## Infrastructure

- **AWS (SST v3)**: Static sites (admin, examples), dev deployments
- **GCP (Pulumi)**: Production (backend, wallet, business, listener) on GKE
- **Stages**: dev, prod, gcp-staging, gcp-production
- **Docker**: Multi-stage with SDK pre-building optimization (shared base image)

## Custom Agents

Purpose-based agents in `.opencode/agent/`:

### Orchestrator

| Agent | Purpose | Activation |
|-------|---------|------------|
| `frak-builder` | Plans, delegates, executes complex tasks | Include `frakwork` or `fw` in prompt |

**FrakBuilder** auto-delegates to specialists, runs parallel tasks, and enforces todo completion (Sisyphus mode).

### Specialists

| Agent | Purpose | When to Use |
|-------|---------|-------------|
| `explore` | Fast codebase search | Finding files, patterns, quick navigation |
| `architect` | Strategic thinking | Complex bugs, design decisions, code review |
| `librarian` | Knowledge research | Documentation, implementation examples |
| `frontend-builder` | UI/UX implementation | Components, styling, accessibility |
| `backend-builder` | API & data work | Endpoints, schemas, business logic |
| `infra-ops` | Infrastructure | Deployment, config, CI/CD |

**Domain-specific context** in `AGENTS.md` files per directory:
- `services/backend/AGENTS.md` - Backend patterns
- `apps/wallet/AGENTS.md` - Wallet app patterns
- `apps/business/AGENTS.md` - Business dashboard patterns
- `apps/listener/AGENTS.md` - Listener patterns
- `apps/dashboard-admin/AGENTS.md` - Admin dashboard patterns
- `apps/shopify/AGENTS.md` - Shopify app patterns (React Router v7, Polaris)
- `apps/shopify/app/services.server/AGENTS.md` - Shopify server services
- `apps/shopify/app/components/AGENTS.md` - Shopify Polaris components
- `apps/shopify/app/hooks/AGENTS.md` - Shopify client hooks
- `apps/shopify/app/routes/AGENTS.md` - Shopify route patterns
- `apps/shopify/extensions/AGENTS.md` - Shopify theme + pixel extensions
- `sdk/AGENTS.md` - SDK architecture
- `sdk/core/AGENTS.md`, `sdk/react/AGENTS.md`, `sdk/components/AGENTS.md` - SDK package specifics
- `packages/AGENTS.md` - Shared packages overview
- `packages/wallet-shared/AGENTS.md`, `packages/ui/AGENTS.md` - Package specifics
- `packages/app-essentials/AGENTS.md` - Blockchain + WebAuthn config
- `packages/test-foundation/AGENTS.md` - Test infrastructure
- `infra/AGENTS.md` - Infrastructure patterns

## Notes

- Service worker required before wallet dev/build: `bun run build:sw`
- TanStack Router typegen before typecheck: runs automatically
- Drizzle schemas: `src/domain/*/db/schema.ts` pattern
- Linked packages (Changesets): frame-connector, core-sdk, react-sdk
- Workspace exports use `development` condition for source in monorepo
