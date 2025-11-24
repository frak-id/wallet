import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Panel } from "./index";

describe("Panel", () => {
    it("should render with default props", () => {
        render(<Panel>Content</Panel>);

        expect(screen.getByText("Content")).toBeInTheDocument();
    });

    it("should render all variants", () => {
        const variants = [
            "primary",
            "secondary",
            "outlined",
            "empty",
            "invisible",
        ] as const;

        variants.forEach((variant) => {
            const { unmount } = render(
                <Panel variant={variant}>Content</Panel>
            );
            expect(screen.getByText("Content")).toBeInTheDocument();
            unmount();
        });
    });

    it("should render all sizes", () => {
        const sizes = ["none", "small", "normal", "big"] as const;

        sizes.forEach((size) => {
            const { unmount } = render(<Panel size={size}>Content</Panel>);
            expect(screen.getByText("Content")).toBeInTheDocument();
            unmount();
        });
    });

    it("should render with shadow when withShadow is true", () => {
        const { container } = render(<Panel withShadow>Content</Panel>);

        const panel = container.firstChild;
        expect(panel).toBeInTheDocument();
    });

    it("should apply custom className", () => {
        const { container } = render(
            <Panel className="custom-panel">Content</Panel>
        );

        const panel = container.firstChild;
        expect(panel).toHaveClass("custom-panel");
    });

    it("should render with cover image", () => {
        const { container } = render(
            <Panel cover="/test-image.jpg">Content</Panel>
        );

        const panel = container.firstChild as HTMLElement;
        expect(panel).toHaveStyle({
            backgroundImage: "url(/test-image.jpg)",
        });
    });

    it("should render dismiss button when isDismissible is true", () => {
        render(<Panel isDismissible>Content</Panel>);

        const dismissButton = screen.getByRole("button");
        expect(dismissButton).toBeInTheDocument();
    });

    it("should hide panel when dismiss button is clicked", () => {
        render(<Panel isDismissible>Content</Panel>);

        const dismissButton = screen.getByRole("button");
        fireEvent.click(dismissButton);

        expect(screen.queryByText("Content")).not.toBeInTheDocument();
    });

    it("should not render dismiss button when isDismissible is false", () => {
        render(<Panel>Content</Panel>);

        expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("should render children", () => {
        render(
            <Panel>
                <div data-testid="child">Child content</div>
            </Panel>
        );

        expect(screen.getByTestId("child")).toBeInTheDocument();
        expect(screen.getByText("Child content")).toBeInTheDocument();
    });
});
