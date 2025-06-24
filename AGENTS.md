# Frak Wallet Agent Instructions

This document provides guidelines for AI agents working on the Frak Wallet monorepo.

## Commands

- **Package Manager**: Use `bun` for all operations.
- **Development**: `bun dev`
- **Build**: `bun run build:sdk`, `bun run build:infra`
- **Lint**: `bun run lint`
- **Format**: `bun run format`
- **Typecheck**: `bun run typecheck`
- **Test**: No specific global test command found. Check package-specific commands. To run a single test, use a command like `bun test -- <path_to_test_file>`.

## Code Style

- **Language**: TypeScript. Prefer `types` over `interfaces`.
- **Formatting**: Use `bun run format` (Biome).
- **Imports**: Use absolute imports: `@/...`
- **Styling**: CSS Modules. No Tailwind.
- **Patterns**: Functional, declarative programming. Avoid classes. Use early returns.
- **Naming**:
  - Directories: `lowercase-with-dashes`
  - Variables: `camelCase`, use auxiliary verbs (e.g., `isLoading`).
  - Event handlers: `handleEvent` (e.g., `handleClick`).
- **Error Handling**: Avoid `try/catch` unless necessary for abstraction.
- **Performance**: Critical. Minimize 'use client', 'useEffect', and 'setState' in Next.js.
- **Authentication**: WebAuthn-first approach.
