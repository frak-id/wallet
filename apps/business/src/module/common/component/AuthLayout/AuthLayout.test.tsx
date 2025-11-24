import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AuthLayout } from "./index";

describe("AuthLayout", () => {
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
});
