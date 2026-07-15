import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Spinner } from "./index";
import { spinnerStyles } from "./spinner.css";

const classesFor = (size: "s" | "m" | "l") =>
    spinnerStyles({ size }).split(" ").filter(Boolean);

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
        const cn = container.querySelector("span")?.className ?? "";
        for (const c of classesFor("s")) expect(cn).toContain(c);
        const sOnly = classesFor("s").find((c) => !classesFor("m").includes(c));
        expect(sOnly).toBeDefined();
        expect(cn).toContain(sOnly);
    });

    it("should render with size l", () => {
        const { container } = render(<Spinner size="l" />);
        const cn = container.querySelector("span")?.className ?? "";
        for (const c of classesFor("l")) expect(cn).toContain(c);
        const lOnly = classesFor("l").find((c) => !classesFor("m").includes(c));
        expect(lOnly).toBeDefined();
        expect(cn).toContain(lOnly);
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
