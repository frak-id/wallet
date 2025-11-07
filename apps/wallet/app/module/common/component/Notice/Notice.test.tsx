import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Notice } from "./index";

describe("Notice", () => {
    it("should render children", () => {
        render(<Notice>Notice text</Notice>);

        expect(screen.getByText("Notice text")).toBeInTheDocument();
    });

    it("should render as span element", () => {
        const { container } = render(<Notice>Content</Notice>);

        const span = container.querySelector("span");
        expect(span).toBeInTheDocument();
    });

    it("should apply custom className", () => {
        const { container } = render(
            <Notice className="custom-notice">Content</Notice>
        );

        const notice = container.querySelector("span");
        expect(notice).toHaveClass("custom-notice");
    });

    it("should render with ReactNode children", () => {
        render(
            <Notice>
                <span data-testid="custom-content">Custom notice</span>
            </Notice>
        );

        expect(screen.getByTestId("custom-content")).toBeInTheDocument();
    });

    it("should render multiple children", () => {
        render(
            <Notice>
                <span>First</span>
                <span>Second</span>
            </Notice>
        );

        expect(screen.getByText("First")).toBeInTheDocument();
        expect(screen.getByText("Second")).toBeInTheDocument();
    });
});
