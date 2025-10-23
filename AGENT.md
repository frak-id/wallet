# AGENT.md - Frak Wallet Development Guide

## Commands
- **Build**: `bun sst build --stage dev` (infra), `bun run --filter '*' typecheck` (all), `bun run --cwd apps/wallet build`
- **Dev**: `bun sst dev` (full stack), `bun run --cwd apps/wallet dev` (wallet only)
- **Deploy**: Use CI only - do not deploy locally. 
- **Lint**: `biome lint .`, `biome check --write .` (format), `biome check .` (check only)
- **Test**: Use `bun test` in specific package directories (no global test command)
- **TypeCheck**: `bun run --filter '*' typecheck` (all packages), `tsc --noEmit` (individual)

## Tech Stack
- **Runtime**: Bun (package manager + runtime), TypeScript, Node.js
- **Frontend**: React 19, React Router v7, Wagmi, TanStack Query, Zustand, Dexie (IndexedDB)
- **Backend**: Elysia, WebAuthn, Jose (JWT)
- **Blockchain**: Viem, Permissionless, Smart Account infrastructure
- **Infrastructure**: SST v3, Pulumi, AWS/GCP deployment
- **Tooling**: Biome (lint/format), Changesets (versioning), Typedoc

## Architecture
- **Monorepo**: Bun workspaces with packages in `apps/`, `packages/`, `sdk/`, `services/`
- **Key Apps**: wallet (React Router), dashboard, dashboard-admin
- **Core Packages**: app-essentials (blockchain utils), shared (tooling/components)
- **SDK**: core, legacy, react, components (external facing)

## Code Style
- **Language**: TypeScript only, use `types` over `interfaces`, avoid `enums` (use maps)
- **Formatting**: Biome (4 spaces, double quotes, semicolons, ES5 trailing commas)
- **Imports**: Absolute imports with `@/` prefix, organize imports enabled
- **Functions**: Use `function` keyword for pure functions, `async/await` over callbacks
- **Naming**: Descriptive names with auxiliary verbs (isLoading, hasError), event handlers with `handle` prefix
- **Architecture**: Functional/declarative patterns, avoid classes, early returns, DRY principles
- **Performance**: Critical - high workload ecosystem, performance is mandatory
