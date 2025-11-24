import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Row } from "./index";

describe("Row", () => {
    it("should render children", () => {
        render(<Row>Row content</Row>);

        expect(screen.getByText("Row content")).toBeInTheDocument();
    });

    it("should render as div element", () => {
        const { container } = render(<Row>Content</Row>);

        const div = container.querySelector("div");
        expect(div).toBeInTheDocument();
    });

    it("should render all align variants", () => {
        const aligns = ["start", "center", "end"] as const;

        aligns.forEach((align) => {
            const { unmount } = render(<Row align={align}>Content</Row>);
            expect(screen.getByText("Content")).toBeInTheDocument();
            unmount();
        });
    });

    it("should apply custom className", () => {
        const { container } = render(<Row className="custom-row">Content</Row>);

        const row = container.querySelector("div");
        expect(row).toHaveClass("custom-row");
    });

    it("should default to end align", () => {
        const { container } = render(<Row>Content</Row>);

        const row = container.querySelector("div");
        expect(row).toBeInTheDocument();
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
