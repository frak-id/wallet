# Frak Wallet Agent Instructions

This document provides quick reference guidelines for AI agents working on the Frak Wallet monorepo.

**Note**: For comprehensive documentation, see [CLAUDE.md](./CLAUDE.md) which contains detailed architecture, testing strategy, and package-specific commands. This file serves as a quick reference.

## Commands

- **Package Manager**: Use `bun` for all operations.
- **Development**: `bun dev`
- **Build**: `bun run build:sdk`, `bun run build:infra`
- **Lint**: `bun run lint`
- **Format**: `bun run format`
- **Typecheck**: `bun run typecheck`
- **Test**:
  - Unit tests (Vitest 4.0 Projects): `bun run test` (from root - runs all 6 projects: wallet, listener, business, wallet-shared, core-sdk, react-sdk)
  - Individual project tests: `cd apps/wallet && bun run test` or `cd apps/listener && bun run test` or `cd apps/business && bun run test`
  - E2E tests (Playwright): `cd apps/wallet && bun run test:e2e`
  - IMPORTANT: Use `bun run test`, NOT `bun test`

## Code Style

- **Language**: TypeScript. Prefer `types` over `interfaces`.
- **Formatting**: Use `bun run format` (Biome).
- **Imports**: Use absolute imports: `@/...`
- **Styling**: CSS Modules with Lightning CSS (Vite apps) or PostCSS (Next.js legacy). No Tailwind.
  - Lightning CSS: 100x faster, centralized config in `packages/dev-tooling/src/vite.ts`
  - Supports CSS nesting, autoprefixing, minification
  - Targets: Chrome 100+, Safari 14+, Firefox 91+, Edge 100+
- **Patterns**: Functional, declarative programming. Avoid classes. Use early returns.
- **Naming**:
  - Directories: `lowercase-with-dashes`
  - Variables: `camelCase`, use auxiliary verbs (e.g., `isLoading`).
  - Event handlers: `handleEvent` (e.g., `handleClick`).
- **Error Handling**: Avoid `try/catch` unless necessary for abstraction.
- **Performance**: Critical. Minimize 'use client', 'useEffect', and 'setState' in Next.js.
- **Authentication**: WebAuthn-first approach.

## Key Applications

- **`apps/wallet/`** - React Router v7 user wallet (SSR disabled, module-based architecture)
- **`apps/business/`** - TanStack Start business dashboard (SSR enabled, primary dashboard)
- **`apps/dashboard/`** - Next.js 15 business dashboard (legacy)
- **`apps/listener/`** - Iframe communication app for SDK interactions
- **`apps/dashboard-admin/`** - React Router admin interface

## SDK Packages

- **Build Strategy**: tsdown (powered by Rolldown)
- **`sdk/core/`** - Core SDK (NPM: ESM+CJS, CDN: IIFE bundle)
- **`sdk/react/`** - React hooks (NPM: ESM+CJS)
- **`sdk/components/`** - Web Components (NPM: ESM, CDN: ESM with code splitting + custom CSS plugin)
- **`sdk/legacy/`** - Legacy IIFE bundle for backward compatibility
- **Build**: `bun run build:sdk` (builds all packages in dependency order)

## Testing

- **E2E Tests**: 13 Playwright specs in `apps/wallet/tests/specs/`
- **Unit Tests**: Vitest tests co-located with source files, target 40% coverage
- **Mock Strategy**: Mock external dependencies (Wagmi, TanStack Query, WebAuthn)
