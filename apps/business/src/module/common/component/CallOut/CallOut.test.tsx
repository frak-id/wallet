import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CallOut } from "./index";

describe("CallOut", () => {
    it("should render with text content", () => {
        render(<CallOut>Call out text</CallOut>);

        expect(screen.getByText("Call out text")).toBeInTheDocument();
    });

    it("should render all variants", () => {
        const variants = [
            "primary",
            "secondary",
            "success",
            "danger",
            "information",
            "warning",
        ] as const;

        variants.forEach((variant) => {
            const { unmount } = render(
                <CallOut variant={variant}>Call out</CallOut>
            );
            expect(screen.getByText("Call out")).toBeInTheDocument();
            unmount();
        });
    });

    it("should render as paragraph element", () => {
        const { container } = render(<CallOut>Content</CallOut>);

        const paragraph = container.querySelector("p");
        expect(paragraph).toBeInTheDocument();
    });

    it("should apply custom className", () => {
        const { container } = render(
            <CallOut className="custom-callout">Content</CallOut>
        );

        const callOut = container.querySelector("p");
        expect(callOut).toHaveClass("custom-callout");
    });

    it("should default to primary variant", () => {
        const { container } = render(<CallOut>Content</CallOut>);

        const callOut = container.querySelector("p");
        expect(callOut).toBeInTheDocument();
    });

    it("should render with ReactNode children", () => {
        render(
            <CallOut>
                <span data-testid="custom-content">Custom callout</span>
            </CallOut>
        );

        expect(screen.getByTestId("custom-content")).toBeInTheDocument();
    });
});
