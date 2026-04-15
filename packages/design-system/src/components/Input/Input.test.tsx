/// <reference types="@testing-library/jest-dom" />
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Input } from ".";

describe("Input", () => {
    it("should render an input element inside a span wrapper", () => {
        const { container } = render(<Input aria-label="test" />);
        const wrapper = container.querySelector("span");
        const input = container.querySelector("input");
        expect(wrapper).toBeTruthy();
        expect(input).toBeTruthy();
    });

    it("should forward native input props", () => {
        render(
            <Input placeholder="Enter email" type="email" aria-label="email" />
        );
        const input = screen.getByPlaceholderText("Enter email");
        expect(input).toBeInTheDocument();
        expect(input).toHaveAttribute("type", "email");
    });

    it("should render all 3 length variants", () => {
        const lengths = ["small", "medium", "big"] as const;
        for (const length of lengths) {
            const { container } = render(
                <Input length={length} aria-label={length} />
            );
            expect(container.querySelector("span")).toBeTruthy();
        }
    });

    it("should apply error styling", () => {
        const { container } = render(<Input error aria-label="error" />);
        const wrapper = container.querySelector("span");
        expect(wrapper).toBeTruthy();
        expect(wrapper?.className).toBeTruthy();
    });

    it("should render leftSection", () => {
        render(
            <Input
                leftSection={<span data-testid="left">$</span>}
                aria-label="price"
            />
        );
        expect(screen.getByTestId("left")).toBeInTheDocument();
    });

    it("should render rightSection", () => {
        render(
            <Input
                rightSection={<span data-testid="right">USD</span>}
                aria-label="price"
            />
        );
        expect(screen.getByTestId("right")).toBeInTheDocument();
    });

    it("should set disabled on the input", () => {
        render(<Input disabled aria-label="disabled" />);
        expect(screen.getByLabelText("disabled")).toBeDisabled();
    });

    it("should forward className to wrapper", () => {
        const { container } = render(
            <Input className="custom" aria-label="cls" />
        );
        const wrapper = container.querySelector("span");
        expect(wrapper?.className).toContain("custom");
    });
});
