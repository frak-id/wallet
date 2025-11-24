import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Grid } from "./index";

describe("Grid", () => {
    it("should render children", () => {
        render(
            <Grid>
                <div>Content</div>
            </Grid>
        );

        expect(screen.getByText("Content")).toBeInTheDocument();
    });

    it("should render footer when provided", () => {
        render(
            <Grid footer={<div>Footer content</div>}>
                <div>Main content</div>
            </Grid>
        );

        expect(screen.getByText("Main content")).toBeInTheDocument();
        expect(screen.getByText("Footer content")).toBeInTheDocument();
    });

    it("should not render footer when not provided", () => {
        render(
            <Grid>
                <div>Content</div>
            </Grid>
        );

        expect(screen.getByText("Content")).toBeInTheDocument();
        expect(screen.queryByText("Footer content")).not.toBeInTheDocument();
    });

    it("should apply custom className", () => {
        const { container } = render(
            <Grid className="custom-grid">
                <div>Content</div>
            </Grid>
        );

        const grid = container.firstChild;
        expect(grid).toHaveClass("custom-grid");
    });

    it("should render multiple children", () => {
        render(
            <Grid>
                <div>First</div>
                <div>Second</div>
                <div>Third</div>
            </Grid>
        );

        expect(screen.getByText("First")).toBeInTheDocument();
        expect(screen.getByText("Second")).toBeInTheDocument();
        expect(screen.getByText("Third")).toBeInTheDocument();
    });
});
