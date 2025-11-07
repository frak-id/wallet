import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Warning } from "./index";

describe("Warning", () => {
    it("should render with text", () => {
        render(<Warning text="Warning message" />);
        expect(screen.getByText("Warning message")).toBeInTheDocument();
    });

    it("should render with ReactNode text", () => {
        render(
            <Warning
                text={<span data-testid="custom-text">Custom warning</span>}
            />
        );
        expect(screen.getByTestId("custom-text")).toBeInTheDocument();
    });

    it("should render warning icon", () => {
        const { container } = render(<Warning text="Warning" />);
        // Warning icon (⚠) should be present
        const warningText = container.querySelector(
            "span[class*='warning__text']"
        );
        expect(warningText).toBeInTheDocument();
    });

    it("should render with children", () => {
        render(
            <Warning text="Warning">
                <button type="button">Action</button>
            </Warning>
        );
        expect(screen.getByText("Warning")).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "Action" })
        ).toBeInTheDocument();
    });

    it("should apply custom className", () => {
        const { container } = render(
            <Warning text="Warning" className="custom-warning" />
        );
        const warning = container.querySelector("div");
        expect(warning).toHaveClass("custom-warning");
    });

    it("should render both text and children", () => {
        render(
            <Warning text="Warning message">
                <div data-testid="child-content">Additional content</div>
            </Warning>
        );
        expect(screen.getByText("Warning message")).toBeInTheDocument();
        expect(screen.getByTestId("child-content")).toBeInTheDocument();
    });
});
