# Test Foundation Package

This package (`@frak-labs/test-foundation`) contains shared test configuration and utilities for all test projects in the Frak Wallet monorepo. The test setup uses **Vitest 4.0 Projects API** with 7 projects running in parallel.

## Overview

**Test Projects:**
- `wallet-unit` - Wallet app (React Router v7, jsdom environment)
- `listener-unit` - Listener iframe app (jsdom environment)
- `business-unit` - Business dashboard (TanStack Start, jsdom environment)
- `wallet-shared-unit` - Shared wallet utilities package (jsdom environment)
- `core-sdk-unit` - Core SDK (framework-agnostic, jsdom environment)
- `react-sdk-unit` - React SDK (hooks and providers, jsdom environment)
- `backend-unit` - Elysia backend service (Node environment)

**Test Environments:** 
- Frontend projects: jsdom (recommended over happy-dom due to better API compatibility)
- Backend project: Node (server-side, no browser APIs needed)

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

## Package Structure

```
packages/test-foundation/
├── package.json                        # Package configuration
├── tsconfig.json                       # TypeScript configuration
├── README.md                           # This file
└── src/
    ├── index.ts                        # Main exports
    ├── vitest.shared.ts                # Shared Vitest config + plugin helpers
    ├── shared-setup.ts                 # Browser API mocks (all projects)
    ├── react-setup.ts                  # React-specific setup (5 projects)
    ├── react-testing-library-setup.ts  # RTL cleanup + jest-dom (5 projects)
    ├── wallet-mocks.ts                 # Wagmi/Router/WebAuthn mocks (2 projects)
    ├── apps-setup.ts                   # Environment variables (3 projects)
    ├── router-mocks.ts                 # Router mock factories
    └── dom-mocks.ts                    # DOM mocking utilities
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
import { getReactTestPlugins } from "@frak-labs/test-foundation/vitest.shared";

export default mergeConfig(
    sharedConfig,
    defineConfig({
        plugins: await getReactTestPlugins(),
        // ...
    })
);

// With custom tsconfig location:
plugins: await getReactTestPlugins({ tsconfigProjects: ["./tsconfig.json"] })
```

### `getReactOnlyPlugins()`

Minimal plugins for React-only projects without TypeScript path mapping.

**Includes:**
- `@vitejs/plugin-react` only

**Used by:** wallet-shared package

**Usage:**
```typescript
import { getReactOnlyPlugins } from "@frak-labs/test-foundation/vitest.shared";

plugins: await getReactOnlyPlugins()
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
import { setupTanStackRouterMock } from "@frak-labs/test-foundation";
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
import { setupListenerDomMocks } from "@frak-labs/test-foundation";
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
} from "@frak-labs/test-foundation";

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

## Standardized Import Patterns

To simplify imports and improve consistency, use these recommended import patterns across all test files.

### Centralized Test Utilities (Recommended)

The `@frak-labs/test-foundation` package provides a single entry point for test utilities:

```typescript
// ✅ RECOMMENDED: Import utilities from test-foundation
import {
    // Router mocks
    setupTanStackRouterMock,
    createTanStackRouterMock,
    // DOM mocks
    mockWindowOrigin,
    mockDocumentReferrer,
    setupListenerDomMocks,
    // Plugin helpers
    getReactTestPlugins,
    getReactOnlyPlugins,
} from "@frak-labs/test-foundation";

// Factory functions and fixtures import directly from wallet-shared:
import { createMockSession, createMockAddress } from "@frak-labs/wallet-shared/test";
```

### Fixtures Import Pattern

Always import test fixtures from the appropriate fixture file for proper typing:

```typescript
// ✅ For wallet-shared, core-sdk, react-sdk tests:
import { test, expect, describe, vi } from "@frak-labs/wallet-shared/tests/vitest-fixtures";

// ✅ For wallet app tests (includes wallet-specific fixtures):
import { test, expect, describe, vi } from "@/tests/vitest-fixtures";

// ✅ For business app tests (includes business-specific fixtures):
import { test, expect, describe, vi } from "@/tests/vitest-fixtures";

// ✅ For listener app tests:
import { test, expect, describe, vi } from "@/tests/vitest-fixtures";
```

**Why?** Each project may extend base fixtures with project-specific fixtures. Using the project's fixture file ensures you get all available fixtures with proper TypeScript typing.

### Factory Functions

```typescript
// ✅ Import factory functions from wallet-shared
import { createMockSession, createMockAddress } from "@frak-labs/wallet-shared/test";
```

### React Testing Library

```typescript
// ✅ Standard RTL imports
import { render, screen, waitFor } from "@testing-library/react";
import { renderHook, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
```

### Complete Import Example

Here's a complete example showing the recommended import organization:

```typescript
// 1. External testing libraries
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// 2. Test utilities from test-foundation package
import { setupTanStackRouterMock, mockWindowOrigin } from "@frak-labs/test-foundation";

// 3. Factory functions from wallet-shared
import { createMockSession } from "@frak-labs/wallet-shared/test";

// 4. Test fixtures (use project-specific for proper typing)
import { test, expect, describe, vi } from "@/tests/vitest-fixtures";

// 5. Code under test
import { LoginForm } from "./LoginForm";
import type { LoginFormProps } from "./types";

describe("LoginForm", () => {
    test("should render login form", ({ mockSession }) => {
        // Test implementation
    });
});
```

### What NOT to Import

```typescript
// ❌ DON'T: Import setup files directly (they run automatically)
import "./vitest-setup";
import "@frak-labs/test-foundation/shared-setup";

// ❌ DON'T: Import from internal paths
import { test } from "vitest"; // Use project fixtures instead

// ❌ DON'T: Mix fixture sources
import { test } from "@frak-labs/wallet-shared/tests/vitest-fixtures";
import { expect } from "vitest"; // Use expect from fixtures for consistency
```

### TypeScript Path Aliases

The monorepo uses these path aliases for cleaner imports:

```typescript
// Wallet app, Business app, Listener app:
import { Component } from "@/module/component/Component"; // → app/module/component/Component

// Test files in any app:
import { test } from "@/tests/vitest-fixtures"; // → tests/vitest-fixtures

// Shared packages:
import { sessionStore } from "@frak-labs/wallet-shared"; // → packages/wallet-shared/src/index
import { createMockSession } from "@frak-labs/wallet-shared/test"; // → packages/wallet-shared/src/test/factories
```

### Migration Guide

If you have existing test files with scattered imports, migrate them like this:

**Before:**
```typescript
import { test, expect } from "vitest";
import { setupTanStackRouterMock } from "../../../test-setup/router-mocks";
import { mockWindowOrigin } from "../../../test-setup/dom-mocks";
import { createMockSession } from "@frak-labs/wallet-shared/test";
```

**After:**
```typescript
// Test fixtures from project-specific file
import { test, expect } from "@/tests/vitest-fixtures";

// Test utilities from test-foundation package
import { setupTanStackRouterMock, mockWindowOrigin } from "@frak-labs/test-foundation";

// Factory functions from wallet-shared
import { createMockSession } from "@frak-labs/wallet-shared/test";
```

**Benefits:**
- ✅ Shorter, cleaner imports using workspace package name
- ✅ Consistent pattern across all test files
- ✅ Easier to refactor (single source of truth)
- ✅ Better IntelliSense support
- ✅ Type-safe with proper fixture typing
- ✅ No TypeScript path aliases needed

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

### backend (services/backend)

**Setup Files:**
- `test/vitest-setup.ts` - Backend-specific setup (Node environment)
- `test/mock/viem.ts` - Viem actions, Permissionless, Ox library mocks
- `test/mock/webauthn.ts` - SimpleWebAuthn server mocks
- `test/mock/common.ts` - Drizzle DB, backend infrastructure, Bun runtime mocks

**Special Features:**
- Node environment (not jsdom)
- Path aliases for `@backend-*` imports
- Mock Bun runtime APIs for Node.js compatibility
- Drizzle ORM mock with flexible query builder
- Viem blockchain interaction mocks
- WebAuthn signature verification mocks

**Note:** Backend does not use shared frontend mocks (browser APIs, React, Wagmi) as it's a server-side Node.js application.

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
   - Verify imports use `@frak-labs/test-foundation` package name
   - Ensure Bun workspace resolution is working (`bun install`)

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

## Test Suite Structure Guidelines

Consistent test structure improves readability and maintainability. Follow these patterns when organizing your test files.

### Recommended Test Organization Pattern

```typescript
import { test, expect, describe } from "./vitest-fixtures";

// Group related tests using describe blocks
describe("FeatureName", () => {
    // Nested describe for specific methods/behaviors
    describe("methodName", () => {
        test("should handle success case", ({ mockFixture }) => {
            // Arrange: Set up test data and mocks
            const input = "test-input";

            // Act: Execute the code under test
            const result = methodName(input);

            // Assert: Verify the results
            expect(result).toBe("expected-output");
        });

        test("should handle error case", () => {
            // Test error scenarios
            expect(() => methodName(null)).toThrow();
        });
    });

    describe("anotherMethod", () => {
        test("should do something else", () => {
            // ...
        });
    });
});
```

### Component Test Pattern

```typescript
import { render, screen } from "@testing-library/react";
import { test, expect, describe } from "./vitest-fixtures";
import { ComponentName } from "./ComponentName";

describe("ComponentName", () => {
    test("should render children", () => {
        render(<ComponentName>Hello World</ComponentName>);
        expect(screen.getByText("Hello World")).toBeInTheDocument();
    });

    test("should apply className prop", () => {
        const { container } = render(
            <ComponentName className="custom-class">Content</ComponentName>
        );
        expect(container.firstChild).toHaveClass("custom-class");
    });

    test("should handle click events", async () => {
        const handleClick = vi.fn();
        render(<ComponentName onClick={handleClick} />);

        await userEvent.click(screen.getByRole("button"));
        expect(handleClick).toHaveBeenCalledTimes(1);
    });
});
```

### Hook Test Pattern

```typescript
import { renderHook, waitFor } from "@testing-library/react";
import { test, expect, describe } from "./vitest-fixtures";
import { useCustomHook } from "./useCustomHook";

describe("useCustomHook", () => {
    test("should return initial state", ({ queryWrapper }) => {
        const { result } = renderHook(() => useCustomHook(), {
            wrapper: queryWrapper.wrapper,
        });

        expect(result.current.data).toBeUndefined();
        expect(result.current.isLoading).toBe(false);
    });

    test("should update state on action", ({ queryWrapper }) => {
        const { result } = renderHook(() => useCustomHook(), {
            wrapper: queryWrapper.wrapper,
        });

        act(() => {
            result.current.updateData("new-value");
        });

        expect(result.current.data).toBe("new-value");
    });
});
```

### Store Test Pattern

```typescript
import { test, expect, describe } from "./vitest-fixtures";

describe("sessionStore", () => {
    describe("setSession", () => {
        test("should set session", ({ freshSessionStore, mockSession }) => {
            freshSessionStore.getState().setSession(mockSession);

            const state = freshSessionStore.getState();
            expect(state.session).toEqual(mockSession);
        });

        test("should clear session when undefined", ({ freshSessionStore }) => {
            freshSessionStore.getState().setSession(undefined);

            const state = freshSessionStore.getState();
            expect(state.session).toBeNull();
        });
    });

    describe("clearSession", () => {
        test("should clear all session data", ({
            freshSessionStore,
            mockSession
        }) => {
            // Setup initial state
            freshSessionStore.getState().setSession(mockSession);

            // Clear session
            freshSessionStore.getState().clearSession();

            // Verify cleared
            const state = freshSessionStore.getState();
            expect(state.session).toBeNull();
            expect(state.sdkSession).toBeNull();
        });
    });
});
```

### Test File Size Guidelines

- **Small**: <100 lines - Single function/component with few test cases
- **Medium**: 100-300 lines - Multiple related tests for a feature
- **Large**: >300 lines - Consider splitting into multiple files

**When to split:**
```
// Instead of one large file:
recoveryStore.test.ts (500 lines)

// Split into focused files:
recoveryStore.password.test.ts
recoveryStore.wallet.test.ts
recoveryStore.encryption.test.ts
```

### Test Naming Conventions

```typescript
// ✅ Good: Describes behavior clearly
test("should return user data when authenticated", () => {});
test("should throw error when token is expired", () => {});
test("should render loading state during fetch", () => {});

// ❌ Bad: Vague or implementation-focused
test("test 1", () => {});
test("user function works", () => {});
test("should call useState", () => {});
```

### Setup Hooks Pattern

```typescript
import { test, describe, beforeEach, afterEach } from "./vitest-fixtures";

describe("FeatureWithSetup", () => {
    beforeEach(({ freshSessionStore, mockSession }) => {
        // Common setup for all tests in this suite
        freshSessionStore.getState().setSession(mockSession);
    });

    afterEach(() => {
        // Cleanup specific to this suite (fixtures auto-cleanup)
        vi.clearAllMocks();
    });

    test("should use setup from beforeEach", ({ freshSessionStore }) => {
        // Session is already set from beforeEach
        expect(freshSessionStore.getState().session).toBeDefined();
    });
});
```

### Import Organization

```typescript
// 1. External dependencies
import { renderHook, waitFor } from "@testing-library/react";
import { act } from "react";

// 2. Test utilities (fixtures, mocks, helpers)
import { test, expect, describe, vi } from "./vitest-fixtures";
import { createMockSession } from "@frak-labs/wallet-shared/test";

// 3. Code under test
import { useAuthenticatedUser } from "./useAuthenticatedUser";
import type { User } from "./types";
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

1. **Optimized Pool Configuration** (Already Configured ✅)
   - Thread pool configured with CPU-aware worker allocation
   - File parallelism enabled for concurrent test file execution
   - Deterministic sequencing for easier debugging
   - Result: 12% faster test execution

2. **Coverage Disabled by Default** (Already Configured ✅)
   - Coverage only runs in CI (`process.env.CI === "true"`)
   - Use `bun run test:coverage` to enable locally when needed
   - Saves ~20% execution time for routine test runs

3. **Optimized Fixture Cleanup** (Already Configured ✅)
   - Store fixtures only reset after tests (not before AND after)
   - Eliminates double overhead per test

4. **Parallel Test Execution**
   - Vitest runs projects in parallel by default
   - Use `test.concurrent` for independent tests within a file

5. **Optimize Imports**
   - Import only what you need from test utilities
   - Use `@frak-labs/test-foundation` package imports for cleaner code

6. **Mock Expensive Operations**
   - Mock API calls with MSW
   - Mock heavy computations
   - Mock external services (WebAuthn, etc.)

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
