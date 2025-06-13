# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

Frak Wallet is a Web3 infrastructure monorepo for seamless referral tracking and reward systems, enabling corporations to build mouth-to-mouth acquisition campaigns using blockchain technology.

**Package Manager**: Bun (required - do not use npm, pnpm, or yarn)

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
```

### Deployment
```bash
# Deploy to development
bun run deploy

# Deploy to production
bun run deploy:prod

# Deploy to GCP staging/production
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
  - `wallet/` - React Router v7 (SSR) user wallet
  - `dashboard/` - Next.js 15 business dashboard  
  - `dashboard-admin/` - React Router admin interface
- **`packages/`** - Shared libraries (recently refactored)
  - `ui/` - Radix UI-based component library
  - `app-essentials/` - Core blockchain utilities and WebAuthn
  - `client/` - API client abstractions
  - `dev-tooling/` - Build configurations
- **`sdk/`** - Client integration SDKs
  - `core/` - Core SDK functionality
  - `react/` - React hooks and providers
  - `components/` - Web Components for integration
  - `legacy/` - Backward compatibility
- **`services/backend/`** - Elysia.js backend with PostgreSQL/MongoDB
- **`infra/`** - SST v3 and Pulumi infrastructure
- **`example/`** - Integration examples

### Key Technologies
- **Frontend**: React 19, TanStack Query, Viem, Wagmi, CSS Modules
- **Backend**: Elysia.js, PostgreSQL (Drizzle ORM), MongoDB
- **Blockchain**: Account Abstraction (ERC-4337), WebAuthn, Multi-chain support
- **Infrastructure**: SST v3, Pulumi, AWS + GCP hybrid
- **Tooling**: Biome (linting/formatting), Changesets (versioning), Knip (dead code)

### Development Principles
- Use TypeScript for all code; prefer types over interfaces
- Functional and declarative programming patterns; avoid classes
- Use absolute imports with `@/...` paths
- CSS Modules for styling (no Tailwind)
- Early returns for readability
- Performance is critical across all components
- WebAuthn-first authentication approach

### Package-Specific Commands

**Wallet App (`apps/wallet/`)**:
```bash
cd apps/wallet
bun run dev          # Development with service worker build
bun run build        # Production build
bun run typecheck    # Type checking with React Router typegen
bun run i18n:types   # Generate i18n types
```

**Dashboard (`apps/dashboard/`)**:
```bash
cd apps/dashboard
bun run dev          # Next.js development with HTTPS
bun run build        # Next.js production build
```

**Backend (`services/backend/`)**:
```bash
cd services/backend
bun run dev          # Development with SST
bun run dev:env      # Setup environment variables
bun db:studio        # Drizzle Studio
bun db:generate      # Generate migrations
bun db:migrate       # Run migrations
```

**SDK Development**:
```bash
# Build all SDK packages
bun run build:sdk

# Work on specific SDK package
cd sdk/core && bun run build
cd sdk/react && bun run dev
```

## Important Notes

- Always use `bun` as the package manager
- Run `bun run typecheck` before committing changes
- Use Biome for formatting: `bun run format`
- The codebase handles very high workloads - performance is mandatory
- Recent refactoring split shared packages into focused libraries (`ui`, `app-essentials`, `client`, `dev-tooling`)
- WebAuthn and Account Abstraction are core to the authentication flow
- Multi-chain blockchain support via Viem abstractions