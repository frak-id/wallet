# Test Setup Architecture

This directory contains shared test configuration and utilities for all test projects in the Frak Wallet monorepo. The test setup uses **Vitest 4.0 Projects API** with 6 projects running in parallel.

## Overview

**Test Projects:**
- `wallet-unit` - Wallet app (React Router v7, 1927 tests)
- `listener-unit` - Listener iframe app
- `business-unit` - Business dashboard (TanStack Start)
- `wallet-shared-unit` - Shared wallet utilities package
- `core-sdk-unit` - Core SDK (framework-agnostic)
- `react-sdk-unit` - React SDK (hooks and providers)

**Test Environment:** jsdom (recommended over happy-dom due to better API compatibility)

## Setup File Execution Order

Understanding the order in which setup files execute is critical for debugging test issues:

1. **Vitest Config** (`vitest.shared.ts`)
   - Sets environment: jsdom
   - Configures timeouts (10s)
   - Sets up reporters (verbose for CI, default for local)
   - Configures coverage (V8, 40% thresholds)

2. **Setup Files** (executed in order specified in each project's `setupFiles` array):

   **Shared Setup (All Projects):**
   - `shared-setup.ts` - Browser API mocks
     - `crypto.randomUUID` polyfill
     - `window.matchMedia` mock
     - `IntersectionObserver` mock
     - `ResizeObserver` mock
     - `MessageChannel` mock (for iframe communication)

   **React Projects (wallet, listener, business, wallet-shared, react-sdk):**
   - `react-setup.ts` - React-specific setup
     - BigInt serialization for Zustand persist middleware
   - `react-testing-library-setup.ts` - RTL setup
     - Automatic cleanup after each test
     - `@testing-library/jest-dom` matchers

   **Wallet + wallet-shared only:**
   - `wallet-mocks.ts` - Wallet-specific mocks
     - Wagmi hooks (useAccount, useConnect, useBalance, etc.)
     - React Router hooks (via `router-mocks.ts`)
     - WebAuthn API (ox library)
     - IndexedDB (idb-keyval)
   - `{project}/src/test/setup-msw.ts` - MSW API mocking

   **Frontend apps only (wallet, listener, business):**
   - `apps-setup.ts` - Environment variables
     - Backend/Indexer URLs
     - OpenPanel mock
     - document.cookie mock

   **Project-specific:**
   - `{project}/tests/vitest-setup.ts` - Project-specific mocks
     - Business: TanStack Router mocks (via `router-mocks.ts`)
     - Listener: DOM mocks for iframe context (via `dom-mocks.ts`)

## File Structure

```
test-setup/
├── README.md                           # This file
├── vitest.shared.ts                    # Shared Vitest config + plugin helpers
├── shared-setup.ts                     # Browser API mocks (all projects)
├── react-setup.ts                      # React-specific setup (5 projects)
├── react-testing-library-setup.ts      # RTL cleanup + jest-dom (5 projects)
├── wallet-mocks.ts                     # Wagmi/Router/WebAuthn mocks (2 projects)
├── apps-setup.ts                       # Environment variables (3 projects)
├── router-mocks.ts                     # Router mock factories (NEW!)
└── dom-mocks.ts                        # DOM mocking utilities (NEW!)
```

## Plugin Helpers

The `vitest.shared.ts` file exports helper functions for consistent plugin configuration:

### `getReactTestPlugins(options?)`

Standard Vite plugins for React projects with TypeScript path mapping.

**Includes:**
- `@vitejs/plugin-react` - JSX transformation and React Fast Refresh
- `vite-tsconfig-paths` - Resolves TypeScript path aliases

**Used by:** wallet, listener, business apps

**Usage:**
```typescript
import { getReactTestPlugins } from "../../test-setup/vitest.shared";

export default mergeConfig(
    sharedConfig,
    defineConfig({
        plugins: getReactTestPlugins(),
        // ...
    })
);

// With custom tsconfig location:
plugins: getReactTestPlugins({ tsconfigProjects: ["./tsconfig.json"] })
```

### `getReactOnlyPlugins()`

Minimal plugins for React-only projects without TypeScript path mapping.

**Includes:**
- `@vitejs/plugin-react` only

**Used by:** wallet-shared package

**Usage:**
```typescript
import { getReactOnlyPlugins } from "../../test-setup/vitest.shared";

plugins: getReactOnlyPlugins()
```

## Router Mock Factories

The `router-mocks.ts` file provides reusable mock factories for different router libraries, eliminating ~40 lines of duplicated code.

### `setupReactRouterMock(options?)`

Global mock for `react-router` (wallet app, wallet-shared package).

**Mocks:**
- `useNavigate` - Returns mock navigation function
- `useLocation` - Returns location with pathname, search, hash, state
- `useParams` - Returns empty params (can be customized per test)
- `useSearchParams` - Returns URLSearchParams and setter

**Usage:**
```typescript
// In wallet-mocks.ts:
import { setupReactRouterMock } from "./router-mocks";
await setupReactRouterMock();

// With custom options:
await setupReactRouterMock({
    pathname: "/custom",
    search: "?foo=bar",
    hash: "#section"
});
```

### `setupTanStackRouterMock(options?)`

Global mock for `@tanstack/react-router` (business app).

**Mocks:**
- `useNavigate` - Returns mock navigation function
- `useRouter` - Returns mock router with navigate, buildLocation, history
- `useMatchRoute` - Returns mock route matching function
- `useParams` - Returns empty params
- `useSearch` - Returns empty search object
- `useLocation` - Returns location with href, pathname, search, hash

**Usage:**
```typescript
// In business/tests/vitest-setup.ts:
import { setupTanStackRouterMock } from "../../../test-setup/router-mocks";
await setupTanStackRouterMock();
```

## DOM Mock Utilities

The `dom-mocks.ts` file provides utilities for mocking window and document properties, reducing boilerplate.

### `setupListenerDomMocks(options?)`

Complete DOM setup for listener app iframe communication testing.

**Mocks:**
- `window.origin` - For postMessage security validation
- `document.referrer` - To identify parent window origin

**Usage:**
```typescript
// In listener/tests/vitest-setup.ts:
import { setupListenerDomMocks } from "../../../test-setup/dom-mocks";
setupListenerDomMocks();

// With custom values:
setupListenerDomMocks({
    origin: "https://wallet.frak.id",
    referrer: "https://content-creator.com"
});
```

### Individual Utilities

For more granular control:

```typescript
import {
    mockWindowOrigin,
    mockDocumentReferrer,
    mockDocumentCookie
} from "../../../test-setup/dom-mocks";

mockWindowOrigin("https://custom-origin.com");
mockDocumentReferrer("https://custom-parent.com");
mockDocumentCookie("demo=true; session=abc123");
```

## Fixture Inheritance Chain

The test setup uses `test.extend()` for type-safe fixture composition:

```
BaseTestFixtures (wallet-shared/tests/vitest-fixtures.ts)
├── mockAddress: Address
├── mockSession: Session
├── mockSdkSession: SdkSession
├── mockInteractionSession: InteractionSession
├── queryClient: QueryClient
├── queryWrapper: React.FC (wraps components with QueryClientProvider)
├── freshSessionStore: SessionStoreType
├── freshWalletStore: WalletStoreType
├── freshUserStore: UserStoreType
├── freshAuthenticationStore: AuthenticationStoreType
├── mockStoreActions: { session, wallet, user, authentication }
├── mockWagmiHooks: { useAccount, useConnect, useDisconnect, useBalance }
├── mockBackendAPI: MSW handlers
└── mockWebAuthN: WebAuthn API mocks

ReactSdkTestFixtures (sdk/react/tests/vitest-fixtures.ts)
└── extends BaseTestFixtures
    ├── mockFrakClient: FrakClient
    ├── mockFrakConfig: FrakConfig
    ├── mockWalletStatus: WalletStatus
    ├── mockFrakProviders: React.FC (wraps with all providers)
    └── mockCoreActions: Core SDK action mocks
```

## When to Use Fixtures vs Factories

### Use Fixtures (`test.extend()`) when:
- ✅ Need automatic setup/teardown per test
- ✅ Testing hooks with `renderHook()`
- ✅ Require complex provider nesting
- ✅ Want type-safe fixture composition
- ✅ Need fresh store instances per test

**Example:**
```typescript
import { test } from "./vitest-fixtures";

test("should use fresh store", ({ freshSessionStore }) => {
    // Store is automatically reset before this test
    expect(freshSessionStore.getState().session).toBeNull();
});
```

### Use Factories (`createMock*()`) when:
- ✅ Creating multiple variants in one test
- ✅ Building test data with different properties
- ✅ Don't need automatic cleanup
- ✅ Building objects for assertions only

**Example:**
```typescript
import { createMockSession, createMockAddress } from "@frak-labs/wallet-shared/test";

test("should handle multiple sessions", () => {
    const session1 = createMockSession({ token: "token1" });
    const session2 = createMockSession({ token: "token2" });

    expect(session1.token).not.toBe(session2.token);
});
```

## Project-Specific Setup

### Wallet App

**Setup Files:**
- `shared-setup.ts` - Browser API mocks
- `react-setup.ts` - BigInt serialization
- `react-testing-library-setup.ts` - RTL cleanup
- `wallet-mocks.ts` - Wagmi/Router/WebAuthn/IndexedDB
- `apps-setup.ts` - Environment variables
- `wallet-shared/src/test/setup-msw.ts` - MSW API mocking

**Special Features:**
- MSW for API mocking (shared with wallet-shared)
- React Router v7 mocks
- Service worker testing support

### Listener App

**Setup Files:**
- `shared-setup.ts` - Browser API mocks
- `react-setup.ts` - BigInt serialization
- `react-testing-library-setup.ts` - RTL cleanup
- `apps-setup.ts` - Environment variables
- `listener/tests/vitest-setup.ts` - DOM mocks via `dom-mocks.ts`

**Special Features:**
- Iframe communication mocks (`window.origin`, `document.referrer`)
- postMessage testing utilities

### Business App

**Setup Files:**
- `shared-setup.ts` - Browser API mocks
- `react-setup.ts` - BigInt serialization
- `react-testing-library-setup.ts` - RTL cleanup
- `apps-setup.ts` - Environment variables
- `business/tests/vitest-setup.ts` - TanStack Router mocks via `router-mocks.ts`

**Special Features:**
- TanStack Router mocks (different from react-router!)
- TanStack Start specific setup
- Custom tsconfig path mapping

### wallet-shared Package

**Setup Files:**
- `shared-setup.ts` - Browser API mocks
- `react-setup.ts` - BigInt serialization
- `react-testing-library-setup.ts` - RTL cleanup
- `wallet-mocks.ts` - Wagmi/Router/WebAuthn/IndexedDB
- `apps-setup.ts` - Environment variables
- `wallet-shared/src/test/setup-msw.ts` - MSW API mocking

**Special Features:**
- Same setup as wallet app (shared dependency)
- Fixture system with `test.extend()`
- Factory functions for test data

### core-sdk

**Setup Files:**
- `shared-setup.ts` - Browser API mocks only

**Special Features:**
- Framework-agnostic (no React)
- Minimal setup for maximum compatibility

### react-sdk

**Setup Files:**
- `shared-setup.ts` - Browser API mocks
- `react-setup.ts` - BigInt serialization
- `react-testing-library-setup.ts` - RTL cleanup

**Special Features:**
- Extends BaseTestFixtures from wallet-shared
- Core SDK action mocks
- FrakProvider testing utilities

## Common Patterns

### Testing React Hooks

```typescript
import { renderHook } from "@testing-library/react";
import { test } from "./vitest-fixtures";

test("should use query wrapper", ({ queryWrapper }) => {
    const { result } = renderHook(() => useQuery(...), {
        wrapper: queryWrapper,
    });

    expect(result.current.data).toBeDefined();
});
```

### Testing Components with Fresh Stores

```typescript
import { render } from "@testing-library/react";
import { test } from "./vitest-fixtures";

test("should render with fresh session", ({ freshSessionStore }) => {
    // Store is automatically reset before this test
    const { getByText } = render(<Component />);

    expect(freshSessionStore.getState().session).toBeNull();
});
```

### Mocking API Calls with MSW

```typescript
import { http, HttpResponse } from "msw";
import { test } from "./vitest-fixtures";

test("should mock API", ({ mockBackendAPI }) => {
    mockBackendAPI.use(
        http.get("/api/endpoint", () => {
            return HttpResponse.json({ data: "mocked" });
        })
    );

    // Test code that calls /api/endpoint
});
```

### Customizing Router Mocks in Tests

```typescript
import { vi } from "vitest";

test("should navigate on click", () => {
    // Customize mock behavior for this test
    const mockNavigate = vi.fn();
    vi.mocked(useNavigate).mockReturnValue(mockNavigate);

    // Test navigation logic
    expect(mockNavigate).toHaveBeenCalledWith("/target");
});
```

## Debugging Test Setup Issues

### Common Issues

1. **"Cannot find module" errors**
   - Check setupFiles paths are relative to the vitest.config.ts location
   - Verify imports use correct relative paths (e.g., `../../../test-setup/`)

2. **"X is not defined" errors**
   - Verify shared-setup.ts is included in setupFiles
   - Check execution order (shared-setup must run before project-specific setup)

3. **Zustand store state leaking between tests**
   - Use fixtures (`freshSessionStore`, etc.) for automatic reset
   - Or manually reset stores in `afterEach` hooks

4. **Mock not working**
   - Ensure vi.mock() is at top level (not inside describe/test)
   - Check mock is defined before importing the code under test
   - Use vi.mocked() to customize mock behavior per test

5. **Router tests failing**
   - Verify correct router mock is used (react-router vs @tanstack/react-router)
   - Check wallet-mocks.ts or business setup is included in setupFiles

### Enable Verbose Logging

Set `DEBUG=vitest:*` environment variable:

```bash
DEBUG=vitest:* bun run test
```

### Check Setup Execution Order

Add console.log to setup files to verify execution order:

```typescript
// In shared-setup.ts:
console.log("[SETUP] shared-setup.ts executed");
```

## Best Practices

### DO ✅

- Use fixtures for automatic setup/teardown
- Use factories for creating test data variants
- Keep mocks at top level (before imports)
- Document project-specific setup requirements
- Reset store state between tests
- Use `vi.mocked()` to customize mocks per test
- Use descriptive fixture names

### DON'T ❌

- Don't mock TanStack Query globally (create QueryClient per test)
- Don't put React code in core-sdk setup (keep framework-agnostic)
- Don't nest vi.mock() inside describe/test blocks
- Don't use classes for test utilities (use functions)
- Don't share mutable state between tests
- Don't forget to clean up side effects

## Performance Tips

1. **Parallel Test Execution**
   - Vitest runs projects in parallel by default
   - Use `test.concurrent` for independent tests within a file

2. **Optimize Imports**
   - Import only what you need from test utilities
   - Avoid importing entire fixture files if unused

3. **Mock Expensive Operations**
   - Mock API calls with MSW
   - Mock heavy computations
   - Mock external services (WebAuthn, etc.)

4. **Use Coverage Wisely**
   - Exclude UI components from coverage (`**/component/**/*.tsx`)
   - Focus on business logic (40% threshold)
   - Use `--coverage.enabled=false` for faster runs

## Contributing

When adding new test setup:

1. **Consider reusability** - Can it be shared across projects?
2. **Document thoroughly** - Update this README
3. **Use consistent patterns** - Follow existing fixture/factory patterns
4. **Test your setup** - Ensure it works across all projects
5. **Update examples** - Add usage examples to this doc

## Additional Resources

- [Vitest Documentation](https://vitest.dev)
- [React Testing Library](https://testing-library.com/react)
- [MSW Documentation](https://mswjs.io)
- [Zustand Testing Guide](https://github.com/pmndrs/zustand#testing)
