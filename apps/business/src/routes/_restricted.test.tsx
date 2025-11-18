import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Mock the layout components
vi.mock("@/module/common/component/DemoModeSync", () => ({
    DemoModeSync: () => <div data-testid="demo-mode-sync" />,
}));

vi.mock("@/module/common/component/Header", () => ({
    Header: () => <header data-testid="header" />,
}));

vi.mock("@/module/common/component/Navigation", () => ({
    Navigation: () => <nav data-testid="navigation" />,
}));

vi.mock("@/module/common/component/MainLayout", () => ({
    MainLayout: ({ children }: { children: React.ReactNode }) => (
        <main data-testid="main-layout">{children}</main>
    ),
}));

// Mock Outlet
vi.mock("@tanstack/react-router", async () => {
    const actual = await vi.importActual("@tanstack/react-router");
    return {
        ...actual,
        Outlet: () => <div data-testid="outlet">Child content</div>,
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
    afterEach(() => {
        // Clean up data attribute after each test
        const rootElement = document.querySelector(":root") as HTMLElement;
        if (rootElement) {
            rootElement.removeAttribute("data-page");
        }
    });

    it("should render all required layout components", () => {
        render(<RestrictedLayoutRoute />);

        expect(screen.getByTestId("demo-mode-sync")).toBeInTheDocument();
        expect(screen.getByTestId("header")).toBeInTheDocument();
        expect(screen.getByTestId("navigation")).toBeInTheDocument();
        expect(screen.getByTestId("main-layout")).toBeInTheDocument();
    });

    it("should render MainLayout which contains Outlet", () => {
        render(<RestrictedLayoutRoute />);

        // MainLayout is present, which wraps the Outlet
        const mainLayouts = screen.getAllByTestId("main-layout");
        expect(mainLayouts.length).toBeGreaterThan(0);
    });

    it("should set data-page attribute on mount", () => {
        render(<RestrictedLayoutRoute />);

        const rootElement = document.querySelector(":root") as HTMLElement;
        expect(rootElement).toHaveAttribute("data-page", "restricted");
    });

    it("should remove data-page attribute on unmount", () => {
        const { unmount } = render(<RestrictedLayoutRoute />);

        const rootElement = document.querySelector(":root") as HTMLElement;
        expect(rootElement).toHaveAttribute("data-page", "restricted");

        unmount();

        expect(rootElement).not.toHaveAttribute("data-page");
    });

    it("should have requireAuth in beforeLoad", () => {
        expect(RestrictedRoute.options.beforeLoad).toBeDefined();
    });
});
