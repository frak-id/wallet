import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Column, Columns } from "./index";

describe("Columns", () => {
    it("should render columns container", () => {
        const { container } = render(<Columns>Content</Columns>);
        const columns = container.querySelector("div");
        expect(columns).toBeInTheDocument();
    });

    it("should render with children", () => {
        const { getByText } = render(<Columns>Test content</Columns>);
        expect(getByText("Test content")).toBeInTheDocument();
    });

    it("should render with different size variants", () => {
        const sizes = ["full", "threeQuarter", "oneQuarter"] as const;

        sizes.forEach((size) => {
            const { container, unmount } = render(
                <Columns size={size}>Content</Columns>
            );
            expect(container.querySelector("div")).toBeInTheDocument();
            unmount();
        });
    });

    it("should render with different align variants", () => {
        const aligns = ["start", "center"] as const;

        aligns.forEach((align) => {
            const { container, unmount } = render(
                <Columns align={align}>Content</Columns>
            );
            expect(container.querySelector("div")).toBeInTheDocument();
            unmount();
        });
    });

    it("should apply custom className", () => {
        const { container } = render(
            <Columns className="custom-class">Content</Columns>
        );
        const columns = container.querySelector("div");
        expect(columns?.className).toContain("custom-class");
    });

    it("should have default center align", () => {
        const { container } = render(<Columns>Content</Columns>);
        const columns = container.querySelector("div");
        expect(columns?.className).toContain("columns--align-center");
    });
});

describe("Column", () => {
    it("should render column", () => {
        const { container } = render(<Column>Content</Column>);
        const column = container.querySelector("div");
        expect(column).toBeInTheDocument();
    });

    it("should render with children", () => {
        const { getByText } = render(<Column>Test content</Column>);
        expect(getByText("Test content")).toBeInTheDocument();
    });

    it("should render with different size variants", () => {
        const sizes = ["none", "full", "threeQuarter", "oneQuarter"] as const;

        sizes.forEach((size) => {
            const { container, unmount } = render(
                <Column size={size}>Content</Column>
            );
            expect(container.querySelector("div")).toBeInTheDocument();
            unmount();
        });
    });

    it("should render with different justify variants", () => {
        const justifies = ["start", "end"] as const;

        justifies.forEach((justify) => {
            const { container, unmount } = render(
                <Column justify={justify}>Content</Column>
            );
            expect(container.querySelector("div")).toBeInTheDocument();
            unmount();
        });
    });

    it("should apply custom className", () => {
        const { container } = render(
            <Column className="custom-class">Content</Column>
        );
        const column = container.querySelector("div");
        expect(column?.className).toContain("custom-class");
    });

    it("should have default end justify", () => {
        const { container } = render(<Column>Content</Column>);
        const column = container.querySelector("div");
        expect(column?.className).toContain("column--justify-end");
    });
});
