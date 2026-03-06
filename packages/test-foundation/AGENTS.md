# packages/test-foundation

Centralized test configuration and mock infrastructure. Consumed by all 10 Vitest projects (including shopify, ui, components).

## Structure

```
src/
├── vitest.shared.ts     # Shared config, pool tuning, plugin helpers
├── shared-setup.ts      # Browser API mocks
├── react-setup.ts       # BigInt.prototype.toJSON for Zustand persist
├── react-testing-library-setup.ts # RTL cleanup + jest-dom matchers
├── wallet-mocks.ts      # Wagmi hooks, Router, WebAuthn, idb-keyval
├── apps-setup.ts        # Env vars + OpenPanel mock
├── router-mocks.ts      # Router mock factories
├── dom-mocks.ts         # window.origin, document.referrer
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

1. shared-setup.ts      → Browser polyfills (all projects)
2. react-setup.ts       → BigInt serialization (React projects)
3. RTL setup            → Cleanup + matchers (React projects)
4. wallet-mocks.ts      → Wagmi/Router/WebAuthn (wallet + wallet-shared)
5. apps-setup.ts        → Env vars + analytics (wallet, listener, business)
6. Project-specific     → Per-app setup files

## Plugin Helpers

- `getReactTestPlugins()` - React + vite-tsconfig-paths
- `getReactOnlyPlugins()` - React only

## Router Mock Factories

- `setupTanStackRouterMock(options?)` - Global vi.mock for @tanstack/react-router
- `createTanStackRouterMock(options?)` - Factory for custom mock instances
- `MockLink` - Component replacement for `<Link>`

## DOM Mock Utilities

- `mockWindowOrigin(origin)` - Mock window.origin
- `mockDocumentReferrer(referrer)` - Mock document.referrer
- `setupListenerDomMocks(options?)` - Complete setup for listener app

## Conventions

- **Hoisting-safe mocks**: Use getter properties for lazy evaluation
- **Fixture system**: `test.extend()` with auto-reset stores per test
- **MSW**: API mocking for wallet and wallet-shared
- **Vitest 4.0 Projects API**: Auto-discovery via glob patterns

## Notes

- Frontend projects: jsdom environment, concurrent execution
- Backend project: Node environment, sequential execution (stateful mocks)
- Coverage: V8 provider, 40% thresholds, disabled locally by default
- Pool: threads with CPU-aware worker allocation (max workers = CPU count - 1)
