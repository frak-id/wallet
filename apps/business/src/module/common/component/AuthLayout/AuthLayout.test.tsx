import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AuthLayout } from "./index";

describe("AuthLayout", () => {
    afterEach(() => {
        // Clean up data attribute after each test
        const rootElement = document.querySelector(":root") as HTMLElement;
        if (rootElement) {
            rootElement.removeAttribute("data-page");
        }
    });

    it("should render children", () => {
        render(
            <AuthLayout>
                <div>Auth content</div>
            </AuthLayout>
        );

        expect(screen.getByText("Auth content")).toBeInTheDocument();
    });

    it("should render as main element", () => {
        const { container } = render(
            <AuthLayout>
                <div>Content</div>
            </AuthLayout>
        );

        const main = container.querySelector("main");
        expect(main).toBeInTheDocument();
    });

    it("should set data-page attribute on root element", () => {
        render(
            <AuthLayout>
                <div>Content</div>
            </AuthLayout>
        );

        const rootElement = document.querySelector(":root") as HTMLElement;
        expect(rootElement).toHaveAttribute("data-page", "authentication");
    });

    it("should render decorative ellipses", () => {
        const { container } = render(
            <AuthLayout>
                <div>Content</div>
            </AuthLayout>
        );

        // Check for ellipse divs (they have specific class names)
        const ellipses = container.querySelectorAll('[class*="ellipse"]');
        expect(ellipses.length).toBeGreaterThan(0);
    });

    it("should clean up data-page attribute on unmount", () => {
        const { unmount } = render(
            <AuthLayout>
                <div>Content</div>
            </AuthLayout>
        );

        const rootElement = document.querySelector(":root") as HTMLElement;
        expect(rootElement).toHaveAttribute("data-page", "authentication");

        unmount();

        expect(rootElement).not.toHaveAttribute("data-page");
    });
});
