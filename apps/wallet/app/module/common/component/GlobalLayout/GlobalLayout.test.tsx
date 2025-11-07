import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GlobalLayout } from "./index";

// Mock child components
vi.mock("@/module/common/component/Header", () => ({
    Header: () => <div data-testid="header">Header</div>,
}));

vi.mock("@/module/common/component/Navigation", () => ({
    Navigation: () => <nav data-testid="navigation">Navigation</nav>,
}));

vi.mock("@/module/common/component/InAppBrowserToast", () => ({
    InAppBrowserToast: () => (
        <div data-testid="in-app-browser-toast">Toast</div>
    ),
}));

describe("GlobalLayout", () => {
    it("should render with header by default", () => {
        render(<GlobalLayout>Content</GlobalLayout>);

        expect(screen.getByTestId("header")).toBeInTheDocument();
        expect(screen.getByText("Content")).toBeInTheDocument();
        expect(screen.getByTestId("in-app-browser-toast")).toBeInTheDocument();
    });

    it("should render without header when header prop is false", () => {
        render(<GlobalLayout header={false}>Content</GlobalLayout>);

        expect(screen.queryByTestId("header")).not.toBeInTheDocument();
        expect(screen.getByText("Content")).toBeInTheDocument();
    });

    it("should render with navigation when navigation prop is true", () => {
        render(<GlobalLayout navigation>Content</GlobalLayout>);

        expect(screen.getByTestId("navigation")).toBeInTheDocument();
        expect(screen.getByText("Content")).toBeInTheDocument();
    });

    it("should render without navigation by default", () => {
        render(<GlobalLayout>Content</GlobalLayout>);

        expect(screen.queryByTestId("navigation")).not.toBeInTheDocument();
        expect(screen.getByText("Content")).toBeInTheDocument();
    });

    it("should render children", () => {
        render(
            <GlobalLayout>
                <div data-testid="child">Child content</div>
            </GlobalLayout>
        );

        expect(screen.getByTestId("child")).toBeInTheDocument();
        expect(screen.getByText("Child content")).toBeInTheDocument();
    });
});
