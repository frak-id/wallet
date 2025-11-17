# Frak Wallet Agent Instructions

This document provides quick reference guidelines for AI agents working on the Frak Wallet monorepo.

**Note**: For comprehensive documentation, see [CLAUDE.md](./CLAUDE.md) which contains detailed architecture, testing strategy, and package-specific commands. This file serves as a quick reference.

## Commands

- **Package Manager**: Use `bun` for all operations. Never use npm, pnpm, or yarn.
- **Development**: `bun dev`
- **Build**: `bun run build:sdk`, `bun run build:infra`
- **Lint**: `bun run lint`
- **Format**: `bun run format` (Biome formatter)
- **Typecheck**: `bun run typecheck`
- **Test**:
  - **CRITICAL**: Use `bun run test`, NOT `bun test`
  - All unit tests: `bun run test` (runs all 6 Vitest projects in parallel)
  - Single test file: `bun run test path/to/file.test.ts`
  - Single project: `bun run test --project wallet-unit`
  - Test patterns: `bun run test -t "test name pattern"`
  - Watch mode: `bun run test:watch`
  - Coverage: `bun run test:coverage`
  - E2E tests: `cd apps/wallet && bun run test:e2e`

## Code Style

- **Language**: TypeScript. Prefer `type` over `interface`. Avoid enums; use maps.
- **Formatting**: Biome (indent: 4 spaces, quotes: double, semicolons: always, trailing commas: ES5)
- **Imports**: Use absolute imports `@/...` for all files
- **Styling**: CSS Modules only. Lightning CSS (Vite apps) or PostCSS (Next.js legacy). **NO Tailwind**.
  - Use BEM or similar methodology for CSS class names (e.g., `block__element--modifier`)
  - Lightning CSS: 100x faster, centralized config in `packages/dev-tooling/src/vite.ts`
  - Browser targets: Chrome 100+, Safari 14+, Firefox 91+, Edge 100+
- **Patterns**: Functional and declarative programming. Avoid classes. Use early returns. Prefer async/await over callbacks.
- **Naming**:
  - Directories: `lowercase-with-dashes`
  - Variables: `camelCase`, use auxiliary verbs (e.g., `isLoading`, `hasError`)
  - Event handlers: `handle` prefix (e.g., `handleClick`, `handleKeyDown`)
  - Favor named exports for components
- **Error Handling**: Avoid `try/catch` unless necessary for abstraction or error translation
- **Performance**: Critical priority. Minimize `use client`, `useEffect`, and `setState` in Next.js
- **State Management**: Zustand for client state (always use individual selectors, avoid subscribing to entire store)
- **Best Practices**: Follow SOLID and DRY principles. Focus on performance and readability.

## Key Applications

- **`apps/wallet/`** - React Router v7 user wallet (SSR disabled, module-based architecture)
- **`apps/business/`** - TanStack Start business dashboard (SSR enabled, primary dashboard)
- **`apps/dashboard/`** - Next.js 15 business dashboard (legacy, standalone output)
- **`apps/listener/`** - Iframe communication app for SDK interactions
- **`apps/dashboard-admin/`** - React Router admin interface

## SDK Packages

- **Build Strategy**: tsdown (powered by Rolldown) - builds NPM packages (ESM+CJS+types) and CDN bundles (IIFE/ESM)
- **`sdk/core/`** - Core SDK (NPM: ESM+CJS, CDN: IIFE bundle)
- **`sdk/react/`** - React hooks (NPM: ESM+CJS)
- **`sdk/components/`** - Web Components built with Preact (NPM: ESM, CDN: ESM with code splitting)
- **`sdk/legacy/`** - Legacy IIFE bundle for backward compatibility
- **Build**: `bun run build:sdk` (builds all packages in dependency order)

## Testing

- **Unit Tests**: Vitest 4.0 with Projects API, jsdom environment, co-located with source files
  - 6 projects: wallet-unit, listener-unit, business-unit, wallet-shared-unit, core-sdk-unit, react-sdk-unit
  - Coverage target: 40% (lines, functions, branches, statements)
- **E2E Tests**: 13 Playwright specs in `apps/wallet/tests/specs/`
- **Mock Strategy**: Mock external dependencies (Wagmi, TanStack Query, WebAuthn). See `test-setup/` for shared mocks.
- **Test Naming**: "should [expected behavior] when [condition]"
