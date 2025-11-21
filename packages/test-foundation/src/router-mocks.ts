/**
 * Router Mock Factories
 *
 * Provides reusable mock factories for TanStack Router used across the monorepo.
 * This eliminates duplication of router mocking logic across projects.
 *
 * Usage:
 * ```typescript
 * // In wallet-mocks.ts or business/tests/vitest-setup.ts:
 * import { setupTanStackRouterMock } from "@frak-labs/test-foundation";
 * await setupTanStackRouterMock();
 *
 * // With custom options:
 * await setupTanStackRouterMock({ pathname: "/custom", search: "?foo=bar" });
 * ```
 *
 * Projects using these mocks:
 * - @tanstack/react-router: wallet app, business app
 */

import { type ComponentProps, createElement } from "react";
import { vi } from "vitest";

/**
 * Mock Link component for TanStack Router
 *
 * Renders children inside an anchor tag for testing purposes.
 * Preserves className and other props for styling tests.
 */
export function MockLink({
    to,
    children,
    className,
    ...props
}: ComponentProps<"a"> & { to: string }) {
    return createElement("a", { href: to, className, ...props }, children);
}

export type RouterMockOptions = {
    pathname?: string;
    search?: string;
    hash?: string;
    state?: unknown;
};

/**
 * Creates mock implementation for @tanstack/react-router hooks
 *
 * Used by: wallet app, business app (TanStack Start)
 *
 * Mocks the following hooks:
 * - useNavigate: Returns mock navigation function
 * - useRouter: Returns mock router with navigate, buildLocation, history
 * - useRouterState: Returns mock router state with status
 * - useMatchRoute: Returns mock route matching function
 * - useParams: Returns empty params object (can be overridden in tests)
 * - useSearch: Returns empty search object (can be overridden in tests)
 * - useLocation: Returns current location with href, pathname, search, hash
 */
export function createTanStackRouterMock(options: RouterMockOptions = {}) {
    const { pathname = "/", search = "", hash = "" } = options;

    return {
        Link: MockLink,
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
        useRouterState: vi.fn(() => ({
            status: "idle",
            isLoading: false,
            isTransitioning: false,
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
 * Setup @tanstack/react-router global mock with optional customization
 *
 * This creates a global vi.mock() that intercepts all imports of "@tanstack/react-router"
 * and replaces hooks with mock implementations while preserving actual exports.
 *
 * @param options - Optional router state customization
 * @returns Mock object for further customization in tests via vi.mocked()
 */
export async function setupTanStackRouterMock(options?: RouterMockOptions) {
    const { pathname = "/", search = "", hash = "" } = options || {};

    vi.mock("@tanstack/react-router", async () => {
        const actual = await vi.importActual<any>("@tanstack/react-router");
        return {
            ...actual,
            Link: MockLink,
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
            useRouterState: vi.fn(() => ({
                status: "idle",
                isLoading: false,
                isTransitioning: false,
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
    });

    return createTanStackRouterMock(options);
}
