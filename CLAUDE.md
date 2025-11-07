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

# Unit tests with Vitest (wallet app and listener app)
cd apps/wallet
bun run test                  # Run unit tests (IMPORTANT: use "bun run test", not "bun test")
bun run test:ui               # Run with Vitest UI
bun run test:coverage         # Run with coverage report

cd apps/listener
bun run test                  # Run unit tests (IMPORTANT: use "bun run test", not "bun test")
bun run test:ui               # Run with Vitest UI
bun run test:coverage         # Run with coverage report
```

**Testing Strategy**:
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
  - Setup file: `apps/wallet/tests/vitest-setup.ts`
  - Target: 40% code coverage

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
  - `dashboard/` - Next.js 15 business dashboard (standalone output)
  - `dashboard-admin/` - React Router admin interface
- **`packages/`** - Shared internal libraries (workspace-only)
  - `wallet-shared/` - Shared code exclusively for wallet and listener apps (~97 files)
    - **Purpose**: Central package for wallet/listener functionality (NOT used by dashboard or other apps)
    - **Architecture**: Well-organized into 13 domain-focused subdirectories
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
  - `dev-tooling/` - Build configurations (manualChunks, onwarn suppressions)
  - `rpc/` - RPC utilities (published as `@frak-labs/frame-connector`)
- **`sdk/`** - Public SDK packages (published to npm, linked via Changesets)
  - `core/` - Core SDK functionality (rslib build with CDN bundle)
  - `react/` - React hooks and providers
  - `components/` - Web Components for integration
  - `legacy/` - Backward compatibility (ignored by Knip)
- **`services/backend/`** - Elysia.js backend with domain-driven structure
- **`infra/`** - SST v3 (AWS) and Pulumi (GCP) infrastructure
- **`example/`** - Integration examples

### Key Technologies
- **Frontend**: React 19, TanStack Query, Zustand, Viem, Wagmi, CSS Modules, React Router v7, Next.js 15
- **Backend**: Elysia.js, PostgreSQL (Drizzle ORM), MongoDB
- **Blockchain**: Account Abstraction (ERC-4337), WebAuthn, Multi-chain support, Pimlico, ZeroDev
- **Infrastructure**: SST v3 (AWS), Pulumi (GCP), hybrid multi-cloud deployment
- **Tooling**: Biome (4-space, double quotes), Changesets (linked packages), Knip, rslib, Playwright

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

**Dashboard (`apps/dashboard/`)**:
```bash
cd apps/dashboard
bun run dev          # Next.js development with HTTPS (via SST dev)
bun run build        # Next.js production build (standalone output)
bun run typecheck    # Type checking
```

**State Management**:
- All frontend apps use Zustand for global state management
- Dashboard stores located in `apps/dashboard/src/stores/`
- Stores use persist middleware for localStorage synchronization
- Always add "use client" directive to store files for Next.js compatibility
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
bun run build         # Build with rslib (creates dist/ and cdn/ bundle)
bun run build:watch   # Build in watch mode
bun run check-exports # Verify package exports with @arethetypeswrong/cli

cd sdk/react && bun run dev
```

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