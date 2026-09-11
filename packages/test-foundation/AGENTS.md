# packages/test-foundation — Compass

Centralised Vitest 4 config + shared mocks + fixtures. Consumed by every Vitest project in the monorepo — there is one project per `vitest.config.ts`, discovered by glob from the root `vitest.config.ts`. Never hand-maintain a count of them.

## Key Files
- `src/vitest.shared.ts` — shared config, pool tuning, plugin helpers
- `src/shared-setup.ts` — browser polyfills (crypto.randomUUID, matchMedia, IntersectionObserver, ResizeObserver, MessageChannel)
- `src/react-setup.ts` — `BigInt.prototype.toJSON` (needed by Zustand `persist`)
- `src/react-testing-library-setup.ts` — RTL cleanup + jest-dom matchers + `asyncUtilTimeout`
- `src/wallet-mocks.ts` — Wagmi hooks, Router, WebAuthn (ox), `idb-keyval` (wallet + wallet-shared only)
- `src/apps-setup.ts` — env var stubs + writable `document.cookie` (wallet, listener, business)
- `src/tanstack-router-mock.ts` — side-effect module that globally mocks @tanstack/react-router hooks (incl. `MockLink`)
- `src/dom-mocks.ts` — `mockWindowOrigin`, `mockDocumentReferrer`, `mockWindowHistory`, `mockWebLocks`, `setupListenerDomMocks`
- `src/index.ts` — barrel (import utilities from `@frak-labs/test-foundation`)

## Setup Execution Order (critical)
1. `shared-setup` → 2. `react-setup` → 3. RTL setup → 4. `wallet-mocks` (wallet/wallet-shared) → 5. `apps-setup` (frontends) → 6. Per-project setup.

## Non-Obvious Patterns
- **Hoisting-safe mocks**: use getter properties for lazy evaluation — otherwise `vi.mock` + ESM imports order-trap.
- **Import `vi` from `vitest`, not from a fixture barrel**, in any file calling `vi.mock`: only the direct import is hoisted with the `vi.mock` call.
- **Fixture chain** via `test.extend()` — `BaseTestFixtures` (wallet-shared) → `ReactSdkTestFixtures` (react-sdk). Use fixtures for auto-reset; factories (`createMock*`) for variants.
- **One router mock for everyone**: `tanstack-router-mock.ts` mocks `@tanstack/react-router` as a top-level side effect, and `wallet-mocks.ts` imports it — so wallet, wallet-shared and business all share it. Import it for the side effect only; never inside a `describe`.
- **Do NOT mock TanStack Query globally** — create a `QueryClient` per test (`queryWrapper` fixture does this).
- **Coverage disabled locally** — enabled only when `CI=true`. Use `bun run test:coverage` to force-enable.
- **Backend uses Node env**: its setup is separate (`services/backend/test/...`); shared frontend mocks DO NOT apply.
- **Pool**: threads, and `maxWorkers` (`src/vitest.workers.ts`) must be identical everywhere or Vitest refuses to schedule — CPU−1 on CI, half the cores locally. Tests within a file always run sequentially (`sequence.concurrent: false`), files in parallel.
- **`vi` is passed into `mockWindowHistory`**: vitest cannot be imported from a CommonJS context, so the caller hands its own `vi` in.
- **`waitFor` has its own budget, not `testTimeout`'s**: RTL defaults to 1s regardless of the 10s `testTimeout`. With every project sharing CPU−1 workers, a cold transform inside a `waitFor` awaiting a dynamic import fails on load rather than on behaviour — an intermittent failure in files nobody touched. Raised to 5s here; `testTimeout` still bounds a genuine hang.

## Anti-Patterns
Global TanStack Query mocks · mixing router mocks · importing setup files directly (they run automatically) · classes for test utils · shared mutable state across tests · `vi.mock` inside `describe`/`test`.

## See Also
Parent `packages/AGENTS.md` · `packages/wallet-shared/tests/vitest-fixtures.ts` (fixture source) · per-project `tests/vitest-setup.ts`.
