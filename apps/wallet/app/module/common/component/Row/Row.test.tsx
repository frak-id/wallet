import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Row } from "./index";

describe("Row", () => {
    it("should render children", () => {
        render(<Row>Row content</Row>);

        expect(screen.getByText("Row content")).toBeInTheDocument();
    });

    it("should render as paragraph element", () => {
        const { container } = render(<Row>Content</Row>);

        const paragraph = container.querySelector("p");
        expect(paragraph).toBeInTheDocument();
    });

    it("should apply withIcon class when withIcon is true", () => {
        const { container } = render(<Row withIcon>Content</Row>);

        const row = container.querySelector("p");
        expect(row?.className).toContain("withIcon");
    });

    it("should not apply withIcon class when withIcon is false", () => {
        const { container } = render(<Row>Content</Row>);

        const row = container.querySelector("p");
        expect(row?.className).not.toContain("withIcon");
    });

    it("should apply custom className", () => {
        const { container } = render(<Row className="custom-row">Content</Row>);

        const row = container.querySelector("p");
        expect(row).toHaveClass("custom-row");
    });

    it("should render multiple children", () => {
        render(
            <Row>
                <span>First</span>
                <span>Second</span>
            </Row>
        );

        expect(screen.getByText("First")).toBeInTheDocument();
        expect(screen.getByText("Second")).toBeInTheDocument();
    });
});
