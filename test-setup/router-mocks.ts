/**
 * Router Mock Factories
 *
 * Provides reusable mock factories for different router libraries used across the monorepo.
 * This eliminates duplication of router mocking logic across projects.
 *
 * Usage:
 * ```typescript
 * // In wallet-mocks.ts (for react-router):
 * import { setupReactRouterMock } from "./router-mocks";
 * await setupReactRouterMock();
 *
 * // In business/tests/vitest-setup.ts (for @tanstack/react-router):
 * import { setupTanStackRouterMock } from "../../../test-setup/router-mocks";
 * await setupTanStackRouterMock();
 *
 * // With custom options:
 * await setupReactRouterMock({ pathname: "/custom", search: "?foo=bar" });
 * ```
 *
 * Projects using these mocks:
 * - react-router: wallet app, wallet-shared package
 * - @tanstack/react-router: business app
 */

import { vi } from "vitest";

export type RouterMockOptions = {
    pathname?: string;
    search?: string;
    hash?: string;
    state?: unknown;
};

/**
 * Creates mock implementation for react-router hooks
 *
 * Used by: wallet app, wallet-shared package
 *
 * Mocks the following hooks:
 * - useNavigate: Returns mock navigation function
 * - useLocation: Returns current location with pathname, search, hash, state
 * - useParams: Returns empty params object (can be overridden in tests)
 * - useSearchParams: Returns URLSearchParams and setter function
 */
export function createReactRouterMock(options: RouterMockOptions = {}) {
    const { pathname = "/", search = "", hash = "", state = null } = options;

    return {
        useNavigate: vi.fn(() => vi.fn()),
        useLocation: vi.fn(() => ({
            pathname,
            search,
            hash,
            state,
        })),
        useParams: vi.fn(() => ({})),
        useSearchParams: vi.fn(() => [new URLSearchParams(search), vi.fn()]),
    };
}

/**
 * Creates mock implementation for @tanstack/react-router hooks
 *
 * Used by: business app (TanStack Start)
 *
 * Mocks the following hooks:
 * - useNavigate: Returns mock navigation function
 * - useRouter: Returns mock router with navigate, buildLocation, history
 * - useMatchRoute: Returns mock route matching function
 * - useParams: Returns empty params object (can be overridden in tests)
 * - useSearch: Returns empty search object (can be overridden in tests)
 * - useLocation: Returns current location with href, pathname, search, hash
 */
export function createTanStackRouterMock(options: RouterMockOptions = {}) {
    const { pathname = "/", search = "", hash = "" } = options;

    return {
        useNavigate: vi.fn(() => vi.fn()),
        useRouter: vi.fn(() => ({
            navigate: vi.fn(),
            buildLocation: vi.fn(),
            history: {
                go: vi.fn(),
                back: vi.fn(),
                forward: vi.fn(),
            },
        })),
        useMatchRoute: vi.fn(() => vi.fn()),
        useParams: vi.fn(() => ({})),
        useSearch: vi.fn(() => ({})),
        useLocation: vi.fn(() => ({
            href: `http://localhost:3022${pathname}${search}${hash}`,
            pathname,
            search,
            hash,
        })),
    };
}

/**
 * Setup react-router global mock with optional customization
 *
 * This creates a global vi.mock() that intercepts all imports of "react-router"
 * and replaces hooks with mock implementations while preserving actual exports.
 *
 * @param options - Optional router state customization
 * @returns Mock object for further customization in tests via vi.mocked()
 */
export async function setupReactRouterMock(options?: RouterMockOptions) {
    const mocks = createReactRouterMock(options);

    vi.mock("react-router", async () => {
        const actual = await vi.importActual<any>("react-router");
        return {
            ...actual,
            ...mocks,
        };
    });

    return mocks;
}

/**
 * Setup @tanstack/react-router global mock with optional customization
 *
 * This creates a global vi.mock() that intercepts all imports of "@tanstack/react-router"
 * and replaces hooks with mock implementations while preserving actual exports.
 *
 * @param options - Optional router state customization
 * @returns Mock object for further customization in tests via vi.mocked()
 */
export async function setupTanStackRouterMock(options?: RouterMockOptions) {
    const mocks = createTanStackRouterMock(options);

    vi.mock("@tanstack/react-router", async () => {
        const actual = await vi.importActual<any>("@tanstack/react-router");
        return {
            ...actual,
            ...mocks,
        };
    });

    return mocks;
}
