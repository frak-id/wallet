# packages/test-foundation

Centralized test configuration and mock infrastructure. Consumed by all 7 Vitest projects.

## Structure

```
src/
├── vitest.shared.ts     # Shared config, pool tuning, plugin helpers
├── shared-setup.ts      # Browser API mocks (crypto, matchMedia, IntersectionObserver, ResizeObserver, MessageChannel, Storage)
├── react-setup.ts       # BigInt.prototype.toJSON for Zustand persist
├── react-testing-library-setup.ts # RTL cleanup + jest-dom matchers
├── wallet-mocks.ts      # Wagmi hooks, TanStack Router, WebAuthn (ox), idb-keyval
├── apps-setup.ts        # Environment variables (STAGE, BACKEND_URL, etc.) + OpenPanel mock
├── router-mocks.ts      # TanStack Router mock factories
├── dom-mocks.ts         # window.origin, document.referrer, document.cookie, window.history
└── index.ts             # Barrel export
```

## Where to Look

| Task | Location |
|------|----------|
| Add browser mock | `src/shared-setup.ts` |
| Mock Wagmi/WebAuthn | `src/wallet-mocks.ts` |
| Mock router | `src/router-mocks.ts` |
| Mock DOM APIs | `src/dom-mocks.ts` |
| Add env vars | `src/apps-setup.ts` |
| Vitest shared config | `src/vitest.shared.ts` |

## Setup File Execution Order

```
1. shared-setup.ts      → Browser polyfills (all projects)
2. react-setup.ts       → BigInt serialization (React projects)
3. RTL setup            → Cleanup + matchers (React projects)
4. wallet-mocks.ts      → Wagmi/Router/WebAuthn (wallet + wallet-shared)
5. apps-setup.ts        → Env vars + analytics (wallet, listener, business)
6. Project-specific     → Per-app setup files
```

## Plugin Helpers

- `getReactTestPlugins()` - React + vite-tsconfig-paths (apps with path aliases)
- `getReactOnlyPlugins()` - React only (packages without path aliases)

## Router Mock Factories

- `setupTanStackRouterMock(options?)` - Global vi.mock for @tanstack/react-router
- `createTanStackRouterMock(options?)` - Factory for custom mock instances
- `MockLink` - Component replacement for `<Link>`

## Conventions

- **Hoisting-safe mocks**: Use getter properties for lazy evaluation
- **Zustand store mocks**: Dual-purpose (callable + getState/subscribe)
- **Fixture system**: test.extend with auto-reset stores per test
- **Vitest 4.0 Projects API**: Auto-discovery via glob patterns

## Anti-Patterns

- Importing test-foundation in production code
- Creating new browser mocks per-project (centralize here)
- Using `vi.fn()` without cleanup (use fixture system)
- Sequential test execution for frontend (only backend runs sequential)

## Notes

- Frontend projects: jsdom environment, concurrent execution
- Backend project: Node environment, sequential execution (stateful mocks)
- Coverage: V8 provider, 40% thresholds, disabled locally by default
- Pool: threads with CPU-aware worker allocation (max workers = CPU count - 1)
