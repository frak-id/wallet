import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ButtonLabel } from "./index";

describe("ButtonLabel", () => {
    it("should render children", () => {
        render(<ButtonLabel>Label text</ButtonLabel>);

        expect(screen.getByText("Label text")).toBeInTheDocument();
    });

    it("should render as span element", () => {
        const { container } = render(<ButtonLabel>Label</ButtonLabel>);

        const span = container.querySelector("span");
        expect(span).toBeInTheDocument();
    });

    it("should render with ReactNode children", () => {
        render(
            <ButtonLabel>
                <span data-testid="custom-label">Custom label</span>
            </ButtonLabel>
        );

        expect(screen.getByTestId("custom-label")).toBeInTheDocument();
    });

    it("should render multiple children", () => {
        render(
            <ButtonLabel>
                <span>First</span>
                <span>Second</span>
            </ButtonLabel>
        );

        expect(screen.getByText("First")).toBeInTheDocument();
        expect(screen.getByText("Second")).toBeInTheDocument();
    });
});
