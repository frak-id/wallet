# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

Frak Wallet is a Web3 infrastructure monorepo for seamless referral tracking and reward systems, enabling corporations to build mouth-to-mouth acquisition campaigns using blockchain technology.

**Package Manager**: Bun (required - do not use npm, pnpm, or yarn)
**Formatting**: Biome with 4-space indent, double quotes, semicolons, ES5 trailing commas

## Common Development Commands

### Building and Development
```bash
# Start development server (SST + React Router)
bun dev

# Build SDK packages
bun run build:sdk

# Build infrastructure
bun run build:infra

# Clean build artifacts
bun run clean
```

### Code Quality and Testing
```bash
# Format code (Biome)
bun run format

# Check formatting
bun run format:check

# Lint code
bun run lint

# Type checking across all packages
bun run typecheck

# Dead code elimination
bun run knip

# E2E tests with Playwright (wallet app)
cd apps/wallet
bun run test:e2e              # Run tests against local
bun run test:e2e:dev          # Run tests against dev environment
bun run test:e2e:prod         # Run tests against prod environment
bun run test:e2e:ui           # Run with Playwright UI

# Unit tests with Vitest (workspace mode - runs all 6 projects)
bun run test                  # Run all tests across all projects (IMPORTANT: use "bun run test", not "bun test")
bun run test:ui               # Run with Vitest UI for all projects
bun run test:coverage         # Run with coverage report for all projects

# Or run tests for specific projects
cd apps/wallet
bun run test                  # Run wallet app tests only
bun run test:ui               # Run with Vitest UI
bun run test:coverage         # Run with coverage report

cd apps/listener
bun run test                  # Run listener app tests only
bun run test:ui               # Run with Vitest UI
bun run test:coverage         # Run with coverage report
```

**Testing Strategy**:
- **Framework**: Vitest 4.0 with Projects API (workspace mode)
  - 6 test projects: wallet, listener, business, wallet-shared, core-sdk, react-sdk
  - 179 test files, 1927 tests total
  - Run from root with `bun run test` to execute all projects in parallel
- **E2E Tests**: Comprehensive Playwright tests (19 specs) covering user flows
  - Authentication and registration
  - Pairing flows
  - Wallet operations
  - Settings and profile management
  - Located in `apps/wallet/tests/`
- **Unit Tests**: Vitest tests co-located with source files
  - Tests placed next to source files (e.g., `app/module/stores/recoveryStore.test.ts`)
  - Focus on business logic and state management
  - Mock external dependencies (Wagmi, TanStack Query, WebAuthn)
  - Centralized test setup in `test-setup/` directory
  - Target: 40% code coverage

**Test Configuration Architecture**:
- `vitest.config.ts` - Root workspace config (Vitest 4.0 Projects API)
- `test-setup/vitest.shared.ts` - Shared config inherited by all projects
- `test-setup/shared-setup.ts` - Browser API mocks (crypto, MessageChannel, IntersectionObserver, ResizeObserver, matchMedia)
- `test-setup/react-setup.ts` - BigInt serialization for Zustand persist
- `test-setup/wallet-mocks.ts` - Wagmi, React Router, WebAuthn, idb-keyval mocks
- `test-setup/apps-setup.ts` - Environment variables for frontend apps

### Deployment
```bash
# Deploy to development (AWS)
bun run deploy

# Deploy to production (AWS)
bun run deploy:prod

# Deploy example stack
bun run deploy:example

# Deploy to GCP staging/production (backend only)
bun run deploy-gcp:staging
bun run deploy-gcp:prod
```

### Package Management
```bash
# Update dependencies across workspaces
bun run update:deps

# Version packages (Changesets)
bun run changeset:version

# Release SDK packages
bun run changeset:release
```

## Architecture Overview

### Monorepo Structure
- **`apps/`** - Frontend applications
  - `wallet/` - React Router v7 user wallet (SSR disabled, module-based architecture)
  - `business/` - TanStack Start business dashboard (SSR enabled, formerly dashboard-v2)
  - `dashboard/` - Next.js 15 business dashboard (standalone output, legacy)
  - `dashboard-admin/` - React Router admin interface
  - `listener/` - Iframe communication app for SDK interactions
- **`packages/`** - Shared internal libraries (workspace-only)
  - `wallet-shared/` - Shared code exclusively for wallet and listener apps (~97 files)
    - **Purpose**: Central package for wallet/listener functionality (NOT used by dashboard or other apps)
    - **Architecture**: Well-organized into 15 domain-focused subdirectories
    - **Structure**:
      - `authentication/` - WebAuthn authentication (hooks, components, session management)
      - `wallet/` - Smart wallet operations (hooks, actions, balance queries)
      - `pairing/` - Device pairing flows (WebSocket clients, signature requests, UI components)
      - `tokens/` - Token management and display (hooks, components, utilities)
      - `interaction/` - Interaction tracking (hooks, components, processors)
      - `recovery/` - Account recovery flows (encryption, decryption, storage)
      - `stores/` - Zustand state management (4 stores: session, user, wallet, authentication)
      - `types/` - Shared TypeScript type definitions (Session, Balance, WebAuthN, etc.)
      - `common/` - Shared utilities (components, analytics via OpenPanel, storage via idb-keyval)
      - `blockchain/` - Blockchain providers (Viem, Account Abstraction, connectors)
      - `i18n/` - Internationalization configuration (react-i18next setup)
      - `sdk/` - SDK lifecycle utilities and event handlers
      - `providers/` - React context providers (FrakContext for SDK integration)
      - `polyfills/` - Runtime polyfills (BigInt serialization)
      - `test/` - Testing utilities and shared test helpers
    - **Key Dependencies**:
      - Workspace: `@frak-labs/ui`, `@frak-labs/app-essentials`, `@frak-labs/client`, `@frak-labs/core-sdk`, `@frak-labs/frame-connector`
      - External: React 19, Zustand, Viem, Wagmi, TanStack Query, WebAuthn, idb-keyval, OpenPanel
    - **Storage**: Uses lightweight idb-keyval for IndexedDB - service worker optimized (1.73 KB gzipped)
    - **Exports**: Barrel exports in `src/index.ts` for clean imports - use `import { X } from "@frak-labs/wallet-shared"`
    - **Import Pattern**: Used 228 times across wallet (153) and listener (75) apps
    - **Known Issues**:
      - ⚠️ Stores missing "use client" directives (breaks Next.js compatibility)
      - ⚠️ Component duplication with `ui` package (AlertDialog exists in both)
      - ⚠️ Backend type coupling via dev dependency on `@frak-labs/backend-elysia`
    - **Technical Debt**: See `docs/audit/PACKAGE_SPLIT_OPTIONS.md` for refactoring analysis (conclusion: well-organized, needs targeted fixes not full split)
  - `ui/` - Radix UI-based component library (generic, reusable across all apps)
  - `app-essentials/` - Core blockchain utilities and WebAuthn configuration
  - `client/` - API client abstractions (Elysia Eden Treaty integration)
  - `dev-tooling/` - Build configurations (manualChunks, onwarn suppressions, Lightning CSS config)
  - `rpc/` - RPC utilities (published as `@frak-labs/frame-connector`)
- **`sdk/`** - Public SDK packages (published to npm, linked via Changesets)
  - `core/` - Core SDK functionality (tsdown for ESM/CJS, esbuild for CDN bundle)
  - `react/` - React hooks and providers (tsdown build)
  - `components/` - Web Components for integration (tsdown for NPM, esbuild for CDN)
  - `legacy/` - Backward compatibility (esbuild UMD bundle, ignored by Knip)
- **`services/backend/`** - Elysia.js backend with domain-driven structure
- **`infra/`** - SST v3 (AWS) and Pulumi (GCP) infrastructure
- **`example/`** - Integration examples

### Key Technologies
- **Frontend**: React 19, TanStack Query, Zustand, Viem, Wagmi, CSS Modules, TanStack Start, React Router v7, Next.js 15
- **Styling**: Lightning CSS for modern Vite apps (wallet, listener, business), PostCSS for Next.js (dashboard legacy only)
- **Backend**: Elysia.js, PostgreSQL (Drizzle ORM), MongoDB
- **Blockchain**: Account Abstraction (ERC-4337), WebAuthn, Multi-chain support, Pimlico, ZeroDev
- **Infrastructure**: SST v3 (AWS), Pulumi (GCP), hybrid multi-cloud deployment
- **Tooling**: Biome (4-space, double quotes), Changesets (linked packages), Knip, tsdown, esbuild, Playwright

### Development Principles
- Use TypeScript for all code; prefer types over interfaces
- Functional and declarative programming patterns; avoid classes
- Use absolute imports with `@/...` paths (configured via tsconfig paths)
- CSS Modules for styling (no Tailwind)
- Early returns for readability
- Performance is critical - high workload optimization mandatory
- WebAuthn-first authentication approach with Account Abstraction
- Wallet app uses module-based architecture (`app/module/` structure)
- Backend follows domain-driven design (`src/domain/*/` structure)
- **State Management**: Zustand with persist middleware across all frontend apps (wallet, dashboard, listener) for consistency and performance
- **CSS Processing**: Lightning CSS (100x faster than PostCSS) for Vite apps with centralized config in `packages/dev-tooling/src/vite.ts`
  - Targets: Chrome 100+, Safari 14+, Firefox 91+, Edge 100+ (baseline-widely-available)
  - Features: CSS nesting, CSS Modules (camelCase), autoprefixing, minification
  - Apps using Lightning CSS: wallet, listener, business, wallet-ethcc
  - Legacy dashboard (Next.js) uses PostCSS + autoprefixer (being phased out)

### Package-Specific Commands

**Wallet App (`apps/wallet/`)**:
```bash
cd apps/wallet
bun run dev          # Development (builds service worker first, then starts SST dev)
bun run build        # Production build (builds service worker, then React Router)
bun run build:sw     # Build service worker separately (vite --mode sw)
bun run typecheck    # Type checking with React Router typegen (run typegen first)
bun run i18n:types   # Generate i18n types from locales
bun run bundle:check # Analyze bundle with vite-bundle-visualizer
```

**Business Dashboard (`apps/business/`)**:
```bash
cd apps/business
bun run dev          # TanStack Start development (Vite dev server on port 3022)
bun run build        # Production build (Nitro output)
bun run start        # Preview production build locally
bun run start:prod   # Run production build
bun run typecheck    # Type checking
bun run test         # Run Vitest tests
```

**Dashboard Legacy (`apps/dashboard/`)**:
```bash
cd apps/dashboard
bun run dev          # Next.js development with HTTPS (via SST dev)
bun run build        # Next.js production build (standalone output)
bun run typecheck    # Type checking
```

**State Management**:
- All frontend apps use Zustand for global state management
- Business stores located in `apps/business/src/stores/`
- Dashboard (legacy) stores located in `apps/dashboard/src/stores/`
- Stores use persist middleware for localStorage synchronization
- Always add "use client" directive to store files for Next.js/React compatibility
- Use individual selectors for optimal performance: `const value = store((state) => state.value)`
- Avoid subscribing to entire store: `const store = useStore()` causes unnecessary re-renders

**Backend (`services/backend/`)**:
```bash
cd services/backend
bun run dev          # Development with SST (runs dev:watch)
bun run dev:env      # Setup environment variables (uses SST shell)
bun run test         # Run tests
bun run test:watch   # Run tests in watch mode
bun db:studio        # Open Drizzle Studio
bun db:generate      # Generate migrations from schema
bun db:migrate       # Run migrations
```

**SDK Development**:
```bash
# Build all SDK packages (rpc → core → legacy → react → components)
bun run build:sdk

# Work on specific SDK package
cd sdk/core
bun run build         # Build with tsdown (ESM/CJS) + esbuild (CDN bundle)
bun run build:watch   # Build in watch mode (tsdown only)
bun run check-exports # Verify package exports with @arethetypeswrong/cli

cd sdk/react
bun run build         # Build with tsdown (ESM/CJS)
bun run build:watch   # Build in watch mode

cd sdk/components
bun run build         # Build with tsdown (NPM) + esbuild (CDN)

cd sdk/legacy
bun run build         # Build with esbuild (UMD bundle only)
```

**SDK Build Architecture (Dual-Tool Approach)**:
SDK packages use a dual-tool build strategy combining tsdown and esbuild:

- **tsdown**: Builds NPM packages with ESM + CJS + TypeScript declarations → `./dist/`
  - Optimized for library bundling with proper type definitions
  - Fast builds with tree-shaking and minification
  - Used by: `core`, `react`, `components`, `rpc`

- **esbuild**: Builds CDN bundles for browser consumption → `./cdn/`
  - IIFE format with globalName for `<script>` tag usage (`core`, `legacy`)
  - ESM format with code splitting for web components (`components`)
  - Environment variable injection and stage-aware configuration
  - Used by: `core` (IIFE), `components` (ESM), `legacy` (UMD)

**Why not use tsdown for everything?** tsdown cannot:
- Output different formats to different directories (`./dist/` vs `./cdn/`)
- Support code splitting (critical for `components` performance)
- Provide per-entry format control (some ESM+CJS, some IIFE)

This dual-tool approach is industry standard (Vue, React, Preact) for libraries requiring both NPM and CDN distribution. Each esbuild script contains detailed comments explaining its specific use case.

## Important Notes

### Critical Workflows
- **Always use `bun`** as the package manager (never npm, pnpm, or yarn)
- **Service Worker**: Wallet app requires service worker build before dev/build (`bun run build:sw`)
- **React Router**: Run `react-router typegen` before typechecking wallet app
- **Drizzle ORM**: Database schemas located in `src/domain/*/db/schema.ts` pattern

### Code Quality
- Run `bun run typecheck` before committing changes
- Use Biome for formatting: `bun run format` (4-space indent, double quotes, semicolons)
- Performance is mandatory - codebase handles very high workloads
- Cognitive complexity limit: 16 (enforced by Biome)

### Architecture Details
- **Workspace Exports**: Packages use `development` condition to point to source (`src/index.ts`) in monorepo, `import`/`require` for built files
- **Linked Packages**: Changesets links `@frak-labs/frame-connector`, `@frak-labs/core-sdk`, `@frak-labs/react-sdk` for synchronized versioning
- **SST Stages**: Development uses `$dev` flag, production deploys to `dev`/`prod` (AWS) or `gcp-staging`/`gcp-production` (GCP backend only)
- **Module Architecture**: Wallet app organizes code by feature modules in `app/module/`, backend by domains in `src/domain/`
- **WebAuthn + ERC-4337**: Core authentication flow combines WebAuthn passkeys with Account Abstraction smart wallets
- **Multi-chain Support**: Viem abstractions enable seamless blockchain interactions across multiple networks