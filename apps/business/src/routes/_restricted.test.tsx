import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { routeMatchesMock, navigateMock, isAuthenticatedMock } = vi.hoisted(
    () => ({
        routeMatchesMock: vi.fn((): unknown[] => []),
        navigateMock: vi.fn(),
        isAuthenticatedMock: vi.fn(() => true),
    })
);

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
        useNavigate: () => navigateMock,
        useMatches: (options?: { select?: (matches: unknown[]) => unknown }) =>
            options?.select
                ? options.select(routeMatchesMock())
                : routeMatchesMock(),
    };
});

// Mock the auth middleware
vi.mock("@/middleware/auth", () => ({
    requireAuth: vi.fn(() => ({ session: { user: "test" } })),
    isAuthenticated: isAuthenticatedMock,
}));

// Import after mocks
import { Route as RestrictedRoute } from "./_restricted";

// Get the component from the route
const RestrictedLayoutRoute = RestrictedRoute.options
    .component as React.ComponentType;

describe("RestrictedLayoutRoute", () => {
    beforeEach(() => {
        routeMatchesMock.mockReturnValue([]);
        navigateMock.mockClear();
        isAuthenticatedMock.mockReturnValue(true);
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

    it("should redirect to /login when the session dies mid-render", () => {
        isAuthenticatedMock.mockReturnValue(false);

        render(<RestrictedLayoutRoute />);

        expect(navigateMock).toHaveBeenCalledWith({
            to: "/login",
            replace: true,
        });
    });

    it("should not redirect while the session is valid", () => {
        render(<RestrictedLayoutRoute />);

        expect(navigateMock).not.toHaveBeenCalled();
    });

    it("should have requireAuth in beforeLoad", () => {
        expect(RestrictedRoute.options.beforeLoad).toBeDefined();
    });
});
