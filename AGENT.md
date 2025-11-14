# AGENT.md - Frak Wallet Development Guide

## Commands
- **Build**: `bun sst build --stage dev` (infra), `bun run --filter '*' typecheck` (all), `bun run --cwd apps/wallet build`
- **Dev**: `bun sst dev` (full stack), `bun run --cwd apps/wallet dev` (wallet only)
- **Deploy**: Prefer CI for production deployments. Local deployment available: `bun run deploy` (AWS dev), `bun run deploy:prod` (AWS prod), `bun run deploy-gcp:staging`/`deploy-gcp:prod` (GCP backend only) 
- **Lint**: `biome lint .`, `biome check --write .` (format), `biome check .` (check only)
- **Test**: `bun run test` from root (runs all 6 projects via Vitest 4.0 Projects API), or use in individual directories like apps/wallet, apps/business, apps/listener (IMPORTANT: use "bun run test", not "bun test")
- **TypeCheck**: `bun run --filter '*' typecheck` (all packages), `tsc --noEmit` (individual)

## Tech Stack
- **Runtime**: Bun (package manager + runtime), TypeScript, Node.js
- **Frontend**: React 19, TanStack Router, TanStack Start, Wagmi, TanStack Query, Zustand, idb-keyval (IndexedDB)
- **Backend**: Elysia, WebAuthn, Jose (JWT)
- **Blockchain**: Viem, Permissionless, Smart Account infrastructure
- **Infrastructure**: SST v3, Pulumi, AWS/GCP deployment
- **Tooling**: Biome (lint/format), Changesets (versioning), Typedoc

## Architecture
- **Monorepo**: Bun workspaces with packages in `apps/`, `packages/`, `sdk/`, `services/`
- **Key Apps**: wallet (TanStack Router), business (TanStack Start), dashboard (Next.js legacy), dashboard-admin (TanStack Router), listener (iframe)
- **Core Packages**: app-essentials (blockchain utils), wallet-shared (wallet/listener), ui (components)
- **SDK**: core, legacy, react, components (external facing)
  - Uses tsdown (powered by Rolldown): NPM (ESM+CJS+types → `./dist/`) + CDN bundles (→ `./cdn/`)
  - Supports code splitting, multiple output directories, and custom plugins

## Code Style
- **Language**: TypeScript only, use `types` over `interfaces`, avoid `enums` (use maps)
- **Formatting**: Biome (4 spaces, double quotes, semicolons, ES5 trailing commas)
- **Imports**: Absolute imports with `@/` prefix, organize imports enabled
- **Styling**: CSS Modules with Lightning CSS (Vite apps: wallet, listener, business) or PostCSS (Next.js dashboard legacy)
  - Lightning CSS: 100x faster than PostCSS, centralized config in `packages/dev-tooling/src/vite.ts`
  - Browser targets: Chrome 100+, Safari 14+, Firefox 91+, Edge 100+
- **Functions**: Use `function` keyword for pure functions, `async/await` over callbacks
- **Naming**: Descriptive names with auxiliary verbs (isLoading, hasError), event handlers with `handle` prefix
- **Architecture**: Functional/declarative patterns, avoid classes, early returns, DRY principles
- **Performance**: Critical - high workload ecosystem, performance is mandatory
