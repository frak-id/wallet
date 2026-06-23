import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { routeMatchesMock } = vi.hoisted(() => ({
    routeMatchesMock: vi.fn((): unknown[] => []),
}));

// Mock the layout components
vi.mock("@/module/common/component/Header", () => ({
    Header: () => <header data-testid="header" />,
}));

vi.mock("@/module/common/component/Navigation", () => ({
    Navigation: () => <nav data-testid="navigation" />,
}));

// Mock Outlet + the route matches consumed by useIsBareShell
vi.mock("@tanstack/react-router", async () => {
    const actual = await vi.importActual("@tanstack/react-router");
    return {
        ...actual,
        Outlet: () => <div data-testid="outlet">Child content</div>,
        useMatches: (options?: { select?: (matches: unknown[]) => unknown }) =>
            options?.select
                ? options.select(routeMatchesMock())
                : routeMatchesMock(),
    };
});

// Mock the auth middleware
vi.mock("@/middleware/auth", () => ({
    requireAuth: vi.fn(() => ({ session: { user: "test" } })),
}));

// Import after mocks
import { Route as RestrictedRoute } from "./_restricted";

// Get the component from the route
const RestrictedLayoutRoute = RestrictedRoute.options
    .component as React.ComponentType;

describe("RestrictedLayoutRoute", () => {
    beforeEach(() => {
        routeMatchesMock.mockReturnValue([]);
    });

    it("should render all required layout components", () => {
        render(<RestrictedLayoutRoute />);

        expect(screen.getByTestId("header")).toBeInTheDocument();
        expect(screen.getByTestId("navigation")).toBeInTheDocument();
    });

    it("should render main element wrapping Outlet", () => {
        const { container } = render(<RestrictedLayoutRoute />);

        const main = container.querySelector("main");
        expect(main).toBeInTheDocument();
        expect(screen.getByTestId("outlet")).toBeInTheDocument();
    });

    it("should hide the shell on bare routes", () => {
        routeMatchesMock.mockReturnValue([{ staticData: { shell: "bare" } }]);

        const { container } = render(<RestrictedLayoutRoute />);

        expect(screen.queryByTestId("header")).toBeNull();
        expect(screen.queryByTestId("navigation")).toBeNull();
        expect(container.querySelector("main")).toBeInTheDocument();
        expect(screen.getByTestId("outlet")).toBeInTheDocument();
    });

    it("should have requireAuth in beforeLoad", () => {
        expect(RestrictedRoute.options.beforeLoad).toBeDefined();
    });
});
