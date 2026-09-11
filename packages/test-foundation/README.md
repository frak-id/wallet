# @frak-labs/test-foundation

Shared Vitest configuration, setup files and DOM mocks for every Vitest project
in the monorepo. Workspace-only, never published.

Run tests with `bun run test` — `bun test` bypasses Vitest and runs Bun's own
runner.

## Exports

| Entry point | What it is |
|---|---|
| `@frak-labs/test-foundation` | Barrel: `mockWindowOrigin`, `mockDocumentReferrer`, `mockWindowHistory`, `mockWebLocks`, `setupListenerDomMocks`, `getReactTestPlugins`, `getReactOnlyPlugins` |
| `/vitest.shared` | Default shared config + the two plugin helpers |
| `/vitest.workers` | `maxWorkers` — every project must use this same value |
| `/shared-setup` | Browser polyfills: `crypto.randomUUID`, `matchMedia`, `IntersectionObserver`, `ResizeObserver`, `MessageChannel` |
| `/react-setup` | `BigInt.prototype.toJSON` (Zustand `persist` needs it) |
| `/react-testing-library-setup` | RTL cleanup, jest-dom matchers, 5s `asyncUtilTimeout` |
| `/wallet-mocks` | wagmi, `@tanstack/react-router`, ox WebAuthn, `idb-keyval` |
| `/apps-setup` | Env var stubs + writable `document.cookie` |
| `/tanstack-router-mock` | Side-effect module mocking `@tanstack/react-router` |
| `/dom-mocks` | The DOM helpers above, importable directly |

## Usage

```ts
// vitest.config.ts
import sharedConfig, {
    getReactTestPlugins,
} from "@frak-labs/test-foundation/vitest.shared";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
    sharedConfig,
    defineConfig({
        plugins: await getReactTestPlugins(),
        test: {
            setupFiles: [
                "@frak-labs/test-foundation/shared-setup",
                "@frak-labs/test-foundation/react-setup",
                "@frak-labs/test-foundation/react-testing-library-setup",
                "./tests/vitest-setup.ts",
            ],
        },
    })
);
```

`setupFiles` cannot be inherited from the shared config: Vitest resolves those
paths relative to the project's own config file.

## Setup execution order

`shared-setup` → `react-setup` → `react-testing-library-setup` →
`wallet-mocks` (wallet + wallet-shared only) → `apps-setup` (wallet, listener,
business) → the project's own `tests/vitest-setup.ts`.

## Fixtures and factories

Fixtures live in `packages/wallet-shared/tests/vitest-fixtures.ts`
(`BaseTestFixtures`: `mockAddress`, `mockSession`, `mockSdkSession`,
`queryClient`, `queryWrapper`, `freshSessionStore`, `freshAuthenticationStore`,
`mockWagmiHooks`) and app fixture files extend them. Factories
(`createMock*`) live in `@frak-labs/wallet-shared/test`.

```ts
import { expect, test } from "@frak-labs/wallet-shared/tests/vitest-fixtures";

test("keeps the session address", ({ mockSession }) => {
    expect(mockSession.type).toBe("webauthn");
});
```

Use a fixture when you want the auto-reset; use a factory when you need a
variant. Never mock TanStack Query globally — build a `QueryClient` per test
(`queryWrapper` does).

## Notes

- Coverage runs only when `CI=true`; force it locally with `--coverage`.
- The backend project runs in the Node environment with its own setup under
  `services/backend/test/` — none of the mocks here apply to it.
