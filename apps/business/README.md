# Frak Business Dashboard

The Frak Business Dashboard is a comprehensive SaaS application built with TanStack Start for companies to manage their referral campaigns, track performance metrics, and interact with blockchain-based reward systems.

## Overview

This application provides:
- Campaign creation and management
- Performance analytics and metrics
- Member management and push notifications
- Product minting and funding
- Team collaboration features
- Real-time blockchain interactions

## Tech Stack

- **Framework**: TanStack Start with SSR
- **Routing**: TanStack Router
- **State Management**: Zustand with persist middleware
- **Data Fetching**: TanStack Query (React Query)
- **Blockchain**: Viem, Wagmi, Account Abstraction
- **UI Components**: Radix UI primitives
- **Styling**: CSS Modules (no Tailwind)
- **Build Tool**: Vite
- **Server Output**: Nitro
- **Database**: MongoDB
- **Authentication**: Iron Session with WebAuthn

## Development

```bash
# Install dependencies (from monorepo root)
bun install

# Start development server (port 3022)
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
# Production build
bun run build

# Preview production build
bun run start

# Run production build
bun run start:prod
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
- `src/module/` - Feature modules (campaigns, members, products, etc.)
- `src/context/` - Server-side logic (MongoDB, blockchain, API integrations)
- `src/stores/` - Zustand state stores
- `src/components/` - Shared components
- `src/styles/` - Global CSS and themes

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

### Routing

This project uses TanStack Router with file-based routing. Routes are defined as files in `src/routes/`.

To add a new route:
1. Create a new file in `src/routes/` (e.g., `about.tsx`)
2. TanStack Router will automatically generate the route

For navigation, use the `Link` component:
```tsx
import { Link } from "@tanstack/react-router";

<Link to="/about">About</Link>
```

### Data Fetching

Data fetching uses a combination of:
1. **TanStack Query** - For client-side data fetching and caching
2. **TanStack Router Loaders** - For route-level data loading
3. **Server Functions** - For server-side operations

Example with loader:
```tsx
export const Route = createFileRoute("/campaigns")({
  loader: async () => {
    const campaigns = await getCampaigns();
    return { campaigns };
  },
  component: CampaignsPage,
});
```

## Code Style

- **TypeScript only** - Prefer `types` over `interfaces`
- **Functional patterns** - Avoid classes
- **CSS Modules** - All styling uses CSS Modules (no Tailwind)
- **Early returns** - For better readability
- **Performance-first** - This app handles high workloads

## Important Notes

- Always use `bun` as the package manager (never npm, pnpm, or yarn)
- Add "use client" directive to all Zustand store files
- Use CSS Modules for styling (Tailwind is NOT used)
- Run `bun run typecheck` before committing changes
- Follow module-based architecture for new features

## Related Documentation

- See `CLAUDE.md` in the monorepo root for overall project guidelines
- See `.cursor/rules/012-frontend-business.mdc` for AI assistant guidelines
