import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Overlay } from ".";

describe("Overlay", () => {
    it("should render the overlay element", () => {
        render(<Overlay />);
        expect(screen.getByTestId("overlay")).toBeTruthy();
    });

    it("should call onClick when clicked", () => {
        const handleClick = vi.fn();
        render(<Overlay onClick={handleClick} />);
        fireEvent.click(screen.getByTestId("overlay"));
        expect(handleClick).toHaveBeenCalledOnce();
    });

    it("should forward className", () => {
        render(<Overlay className="custom-overlay" />);
        const el = screen.getByTestId("overlay");
        expect(el.className).toContain("custom-overlay");
    });

    it("should render without optional props", () => {
        render(<Overlay />);
        const el = screen.getByTestId("overlay");
        expect(el).toBeTruthy();
    });
});
