# packages/test-foundation — Compass

Centralised Vitest 4 config + shared mocks + fixtures. Consumed by all 10 Vitest projects.

## Key Files
- `src/vitest.shared.ts` — shared config, pool tuning, plugin helpers
- `src/shared-setup.ts` — browser polyfills (crypto.randomUUID, matchMedia, IntersectionObserver, ResizeObserver, MessageChannel)
- `src/react-setup.ts` — `BigInt.prototype.toJSON` (needed by Zustand `persist`)
- `src/react-testing-library-setup.ts` — RTL cleanup + jest-dom matchers
- `src/wallet-mocks.ts` — Wagmi hooks, Router, WebAuthn (ox), `idb-keyval` (wallet + wallet-shared only)
- `src/apps-setup.ts` — env vars + OpenPanel mock (wallet, listener, business)
- `src/router-mocks.ts` — `setupReactRouterMock`, `setupTanStackRouterMock`, `MockLink`
- `src/dom-mocks.ts` — `mockWindowOrigin`, `mockDocumentReferrer`, `setupListenerDomMocks`
- `src/index.ts` — barrel (import utilities from `@frak-labs/test-foundation`)

## Setup Execution Order (critical)
1. `shared-setup` → 2. `react-setup` → 3. RTL setup → 4. `wallet-mocks` (wallet/wallet-shared) → 5. `apps-setup` (frontends) → 6. Per-project setup.

## Non-Obvious Patterns
- **Hoisting-safe mocks**: use getter properties for lazy evaluation — otherwise `vi.mock` + ESM imports order-trap.
- **Fixture chain** via `test.extend()` — `BaseTestFixtures` (wallet-shared) → `ReactSdkTestFixtures` (react-sdk). Use fixtures for auto-reset; factories (`createMock*`) for variants.
- **Router mocks differ by app**: `react-router` for wallet/wallet-shared, `@tanstack/react-router` for business. Mixing them fails silently.
- **Do NOT mock TanStack Query globally** — create a `QueryClient` per test (`queryWrapper` fixture does this).
- **Coverage disabled locally** — enabled only when `CI=true`. Use `bun run test:coverage` to force-enable.
- **Backend uses Node env**: its setup is separate (`services/backend/test/...`); shared frontend mocks DO NOT apply.
- **Pool**: threads, CPU-aware worker allocation (max = CPU−1). Frontend projects run concurrent; backend runs sequential (stateful mocks).

## Anti-Patterns
Global TanStack Query mocks · mixing router mocks · importing setup files directly (they run automatically) · classes for test utils · shared mutable state across tests · `vi.mock` inside `describe`/`test`.

## See Also
Parent `packages/AGENTS.md` · `packages/wallet-shared/src/tests/vitest-fixtures.ts` (fixture source) · per-project `tests/vitest-setup.ts`.
