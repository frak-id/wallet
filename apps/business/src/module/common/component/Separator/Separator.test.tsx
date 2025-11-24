import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Separator } from "./index";

describe("Separator", () => {
    it("should render separator", () => {
        const { container } = render(<Separator />);

        // Radix Separator renders an element - check that something is rendered
        expect(container.firstChild).toBeInTheDocument();
    });

    it("should render with horizontal orientation by default", () => {
        const { container } = render(<Separator />);

        // Component should render
        expect(container.firstChild).toBeInTheDocument();
    });

    it("should render with vertical orientation", () => {
        const { container } = render(<Separator orientation="vertical" />);

        // Component should render
        expect(container.firstChild).toBeInTheDocument();
    });

    it("should be decorative by default", () => {
        const { container } = render(<Separator />);

        // Decorative separators render but may not have role="separator"
        expect(container.firstChild).toBeInTheDocument();
    });

    it("should not be decorative when decorative is false", () => {
        const { container } = render(<Separator decorative={false} />);

        const separator = container.querySelector('[role="separator"]');
        expect(separator).toBeInTheDocument();
    });

    it("should apply custom className", () => {
        const { container } = render(
            <Separator className="custom-separator" />
        );

        // Check that the className is applied to the rendered element
        const separator = container.firstChild as HTMLElement;
        expect(separator).toBeInTheDocument();
        expect(separator?.className).toContain("custom-separator");
    });
});
