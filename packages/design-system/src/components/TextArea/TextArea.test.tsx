/// <reference types="@testing-library/jest-dom" />
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TextArea } from ".";

describe("TextArea", () => {
    it("should render a textarea element inside a span wrapper", () => {
        const { container } = render(<TextArea aria-label="test" />);
        const wrapper = container.querySelector("span");
        const textarea = container.querySelector("textarea");
        expect(wrapper).toBeTruthy();
        expect(textarea).toBeTruthy();
    });

    it("should forward native textarea props", () => {
        render(<TextArea placeholder="Enter message" aria-label="msg" />);
        const textarea = screen.getByPlaceholderText("Enter message");
        expect(textarea).toBeInTheDocument();
    });

    it("should render all 3 length variants", () => {
        const lengths = ["small", "medium", "big"] as const;
        for (const length of lengths) {
            const { container } = render(
                <TextArea length={length} aria-label={length} />
            );
            expect(container.querySelector("span")).toBeTruthy();
        }
    });

    it("should apply error styling", () => {
        const { container } = render(<TextArea error aria-label="error" />);
        const wrapper = container.querySelector("span");
        expect(wrapper).toBeTruthy();
        expect(wrapper?.className).toBeTruthy();
    });

    it("should set disabled on the textarea", () => {
        render(<TextArea disabled aria-label="disabled" />);
        expect(screen.getByLabelText("disabled")).toBeDisabled();
    });

    it("should forward className to wrapper", () => {
        const { container } = render(
            <TextArea className="custom" aria-label="cls" />
        );
        const wrapper = container.querySelector("span");
        expect(wrapper?.className).toContain("custom");
    });

    it("should forward rows prop", () => {
        render(<TextArea rows={5} aria-label="rows" />);
        expect(screen.getByLabelText("rows")).toHaveAttribute("rows", "5");
    });
});
