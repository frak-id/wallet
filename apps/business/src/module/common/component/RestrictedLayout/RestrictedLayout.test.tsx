import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RestrictedLayout } from "./index";

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
    MainLayout: ({ children }: any) => (
        <main data-testid="main-layout">{children}</main>
    ),
}));

describe("RestrictedLayout", () => {
    afterEach(() => {
        // Clean up data attribute after each test
        const rootElement = document.querySelector(":root") as HTMLElement;
        if (rootElement) {
            rootElement.removeAttribute("data-page");
        }
    });

    it("should render children", () => {
        render(
            <RestrictedLayout>
                <div>Restricted content</div>
            </RestrictedLayout>
        );

        expect(screen.getByText("Restricted content")).toBeInTheDocument();
    });

    it("should render all layout components", () => {
        render(
            <RestrictedLayout>
                <div>Content</div>
            </RestrictedLayout>
        );

        expect(screen.getByTestId("demo-mode-sync")).toBeInTheDocument();
        expect(screen.getByTestId("header")).toBeInTheDocument();
        expect(screen.getByTestId("navigation")).toBeInTheDocument();
        expect(screen.getByTestId("main-layout")).toBeInTheDocument();
    });

    it("should set data-page attribute on root element", () => {
        render(
            <RestrictedLayout>
                <div>Content</div>
            </RestrictedLayout>
        );

        const rootElement = document.querySelector(":root") as HTMLElement;
        expect(rootElement).toHaveAttribute("data-page", "restricted");
    });

    it("should clean up data-page attribute on unmount", () => {
        const { unmount } = render(
            <RestrictedLayout>
                <div>Content</div>
            </RestrictedLayout>
        );

        const rootElement = document.querySelector(":root") as HTMLElement;
        expect(rootElement).toHaveAttribute("data-page", "restricted");

        unmount();

        expect(rootElement).not.toHaveAttribute("data-page");
    });
});
