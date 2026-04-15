import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { NumberedCircle } from ".";

describe("NumberedCircle", () => {
    it("should render the number", () => {
        const { getByText } = render(<NumberedCircle number={1} />);
        expect(getByText("1")).toBeTruthy();
    });

    it("should render as span element", () => {
        const { container } = render(<NumberedCircle number={3} />);
        expect(container.querySelector("span")).toBeTruthy();
    });

    it("should render all sizes", () => {
        const sizes = ["sm", "md", "lg"] as const;
        for (const size of sizes) {
            const { getByText, unmount } = render(
                <NumberedCircle number={1} size={size} />
            );
            expect(getByText("1")).toBeTruthy();
            unmount();
        }
    });

    it("should render all color variants", () => {
        const colors = ["primary", "secondary", "action"] as const;
        for (const color of colors) {
            const { getByText, unmount } = render(
                <NumberedCircle number={2} color={color} />
            );
            expect(getByText("2")).toBeTruthy();
            unmount();
        }
    });

    it("should forward className", () => {
        const { container } = render(
            <NumberedCircle number={1} className="custom" />
        );
        expect(container.querySelector(".custom")).toBeTruthy();
    });

    it("should have aria-hidden", () => {
        const { container } = render(<NumberedCircle number={1} />);
        const span = container.querySelector("span");
        expect(span?.getAttribute("aria-hidden")).toBe("true");
    });
});
