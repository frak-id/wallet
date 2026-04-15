import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Spinner } from "./index";

describe("Spinner", () => {
    it("should render with default size (m)", () => {
        const { container } = render(<Spinner />);
        const spinner = container.querySelector("span");
        expect(spinner).toBeInTheDocument();
    });

    it("should render 8 leaf elements", () => {
        const { container } = render(<Spinner />);
        const leaves = container.querySelectorAll("span > span");
        expect(leaves).toHaveLength(8);
    });

    it("should render with size s", () => {
        const { container } = render(<Spinner size="s" />);
        const spinner = container.querySelector("span");
        expect(spinner).toBeInTheDocument();
        expect(spinner?.className).toContain("s");
    });

    it("should render with size l", () => {
        const { container } = render(<Spinner size="l" />);
        const spinner = container.querySelector("span");
        expect(spinner).toBeInTheDocument();
        expect(spinner?.className).toContain("l");
    });

    it("should accept custom className", () => {
        const { container } = render(<Spinner className="custom-class" />);
        const spinner = container.querySelector("span");
        expect(spinner?.className).toContain("custom-class");
    });

    it("should have correct leaf rotation classes", () => {
        const { container } = render(<Spinner />);
        const leaves = container.querySelectorAll("span > span");
        expect(leaves.length).toBe(8);
        // Verify each leaf has a rotation class
        leaves.forEach((leaf, index) => {
            expect(leaf.className).toContain(`leaf${index}`);
        });
    });
});
