/**
 * Side-effect module that globally mocks @tanstack/react-router hooks.
 *
 * Import this for its side effect from a setup file (wallet-mocks.ts,
 * business/tests/vitest-setup.ts). The `vi.mock` lives at module top level so
 * Vitest can hoist it without the "not at top level" warning.
 */

import { type ComponentProps, createElement } from "react";
import { vi } from "vitest";

// Mock Link: renders children in an anchor, preserving className/props.
function MockLink({
    to,
    children,
    className,
    ...props
}: ComponentProps<"a"> & { to: string }) {
    return createElement("a", { href: to, className, ...props }, children);
}

vi.mock("@tanstack/react-router", async () => {
    const actual = await vi.importActual<Record<string, unknown>>(
        "@tanstack/react-router"
    );
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
            href: "http://localhost:3001/",
            pathname: "/",
            search: "",
            hash: "",
        })),
    };
});
