import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Spinner } from "./index";

describe("Spinner", () => {
    it("should render", () => {
        const { container } = render(<Spinner />);
        const spinner = container.querySelector("span");
        expect(spinner).toBeInTheDocument();
    });

    it("should render with 8 spinner leaves", () => {
        const { container } = render(<Spinner />);
        const leaves = container.querySelectorAll(
            "span[class*='spinner__leaf']"
        );
        expect(leaves).toHaveLength(8);
    });

    it("should apply custom className", () => {
        const { container } = render(<Spinner className="custom-spinner" />);
        const spinner = container.querySelector("span");
        expect(spinner).toHaveClass("custom-spinner");
    });

    it("should accept other span props", () => {
        const { container } = render(<Spinner data-testid="spinner" />);
        const spinner = container.querySelector("span[data-testid='spinner']");
        expect(spinner).toBeInTheDocument();
    });
});
