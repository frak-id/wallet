# Frak Business Dashboard

The Frak Business Dashboard is a TanStack Router SPA for merchants to manage their referral campaigns, track performance metrics, and interact with blockchain-based reward systems.

## Overview

This application provides:
- Campaign creation and management
- Performance analytics and metrics
- Member management and push notifications
- Product minting and funding
- Team collaboration features
- Real-time blockchain interactions

## Tech Stack

- **Framework**: TanStack Router (SPA)
- **State Management**: Zustand with persist middleware
- **Data Fetching**: TanStack Query (React Query)
- **Blockchain**: Viem, Account Abstraction
- **UI Components**: Radix UI primitives + `@frak-labs/design-system`
- **Styling**: Vanilla Extract `.css.ts` (no Tailwind, no CSS Modules)
- **Build Tool**: Vite
- **Production Server**: nginx (static files)
- **Authentication**: JWT via backend API + Zustand store

## Development

```bash
# Install dependencies (from monorepo root)
bun install

# Start development server (port 3001)
cd apps/business
bun run dev

# Type checking
bun run typecheck

# Linting and formatting
bun run lint
bun run format:check
bun run format
```

## Building

```bash
# Production build (outputs static files to dist/)
bun run build
```

## Testing

This project uses [Vitest](https://vitest.dev/) for testing:

```bash
# Run tests
bun run test

# Run tests with UI
bun run test:ui

# Run tests with coverage
bun run test:coverage
```

## Architecture

### Directory Structure

- `src/routes/` - File-based routing (TanStack Router)
- `src/module/` - Feature modules (campaigns, members, merchant, etc.)
- `src/config/` - App configuration (auth, environment)
- `src/stores/` - Zustand state stores
- `src/styles/` - Global styles and themes

### Module-Based Architecture

The app follows a module-based architecture where each feature is organized into:
- `component/` - React components
- `hook/` - Custom React hooks
- `utils/` - Utility functions and constants

### State Management

All stores are located in `src/stores/` and use:
- Zustand for global state
- Persist middleware for localStorage sync
- Individual selectors for optimal performance

Example:
```typescript
// Use individual selectors (recommended)
const value = useStore((state) => state.value);

// Avoid subscribing to entire store (causes re-renders)
const { value } = useStore();
```

### Routing and data fetching

File-based TanStack Router over `src/routes/`; `routeTree.gen.ts` is generated, never
edited by hand. Auth is centralised in the `_restricted` layout — do not add per-route
guards. Server data comes from `@frak-labs/client` (Eden Treaty), so backend types flow
through; do not hand-roll fetches.

## Code Style

- **TypeScript only** - Prefer `types` over `interfaces`
- **Functional patterns** - Avoid classes
- **Vanilla Extract** - All styling lives in `.css.ts` files (no Tailwind, no `globalStyle`)
- **Early returns** - For better readability
- **Performance-first** - This app handles high workloads

## Important Notes

- Always use `bun` as the package manager (never npm, pnpm, or yarn)
- Use Vanilla Extract `.css.ts` for styling (Tailwind is NOT used)
- Run `bun run typecheck` before committing changes
- Follow module-based architecture for new features

## Related Documentation

- `apps/business/AGENTS.md` — the non-obvious rules for this app
- `/AGENTS.md` — the monorepo compass
