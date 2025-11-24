import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Column } from "./index";

describe("Column", () => {
    it("should render children", () => {
        render(<Column>Column content</Column>);

        expect(screen.getByText("Column content")).toBeInTheDocument();
    });

    it("should render as div element", () => {
        const { container } = render(<Column>Content</Column>);

        const div = container.querySelector("div");
        expect(div).toBeInTheDocument();
    });

    it("should apply fullWidth class when fullWidth is true", () => {
        const { container } = render(<Column fullWidth>Content</Column>);

        const column = container.querySelector("div");
        expect(column?.className).toContain("fullWidth");
    });

    it("should not apply fullWidth class when fullWidth is false", () => {
        const { container } = render(<Column>Content</Column>);

        const column = container.querySelector("div");
        expect(column?.className).not.toContain("fullWidth");
    });

    it("should apply custom className", () => {
        const { container } = render(
            <Column className="custom-column">Content</Column>
        );

        const column = container.querySelector("div");
        expect(column).toHaveClass("custom-column");
    });

    it("should default fullWidth to false", () => {
        const { container } = render(<Column>Content</Column>);

        const column = container.querySelector("div");
        expect(column?.className).not.toContain("fullWidth");
    });

    it("should render multiple children", () => {
        render(
            <Column>
                <span>First</span>
                <span>Second</span>
            </Column>
        );

        expect(screen.getByText("First")).toBeInTheDocument();
        expect(screen.getByText("Second")).toBeInTheDocument();
    });
});
