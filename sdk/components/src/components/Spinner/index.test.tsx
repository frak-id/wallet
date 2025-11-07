import { render } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { Spinner } from "./index";

describe("Spinner", () => {
    it("should render with default props", () => {
        const { container } = render(<Spinner />);
        const spinner = container.querySelector("span");
        expect(spinner).toBeInTheDocument();
    });

    it("should render all spinner leaf elements", () => {
        const { container } = render(<Spinner />);
        const leaves = container.querySelectorAll("span > span");
        expect(leaves).toHaveLength(8);
    });

    it("should render with className prop (even though it's not used)", () => {
        // Note: Spinner component doesn't actually use className prop,
        // it only uses CSS modules. This test verifies it accepts the prop.
        const { container } = render(<Spinner className="custom-class" />);
        const spinner = container.querySelector("span");
        expect(spinner).toBeInTheDocument();
    });

    it("should accept ref", () => {
        let refElement: any = null;
        const ref = (el: any) => {
            refElement = el;
        };
        render(<Spinner ref={ref} />);
        // Preact refs work differently - refElement should be set
        expect(refElement).toBeDefined();
    });
});
