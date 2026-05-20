/// <reference types="@testing-library/jest-dom" />
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./index";

describe("Button", () => {
    it("should render primary variant with text", () => {
        render(<Button variant="primary">Click me</Button>);
        const btn = screen.getByRole("button", { name: "Click me" });
        expect(btn).toBeInTheDocument();
        expect(btn.tagName).toBe("BUTTON");
    });

    it("should render secondary variant with different className", () => {
        const { rerender } = render(<Button variant="primary">Test</Button>);
        const primaryClass = screen.getByRole("button").className;

        rerender(<Button variant="secondary">Test</Button>);
        const secondaryClass = screen.getByRole("button").className;

        expect(primaryClass).not.toBe(secondaryClass);
    });

    it("should render icon alongside text when icon prop provided", () => {
        const icon = <span data-testid="icon">★</span>;
        render(<Button icon={icon}>With Icon</Button>);
        expect(screen.getByTestId("icon")).toBeInTheDocument();
        expect(screen.getByText("With Icon")).toBeInTheDocument();
    });

    it("should render rightIcon after children", () => {
        const left = <span data-testid="left">L</span>;
        const right = <span data-testid="right">R</span>;
        render(
            <Button icon={left} rightIcon={right}>
                Label
            </Button>
        );
        const leftEl = screen.getByTestId("left");
        const rightEl = screen.getByTestId("right");
        // Assert relative order via DOM position rather than child indices so
        // the test survives future wrappers (e.g. Box) around children.
        expect(
            leftEl.compareDocumentPosition(rightEl) &
                Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy();
    });

    it("should call onClick handler when clicked", () => {
        const handleClick = vi.fn();
        render(<Button onClick={handleClick}>Click</Button>);
        fireEvent.click(screen.getByRole("button"));
        expect(handleClick).toHaveBeenCalledOnce();
    });
});
