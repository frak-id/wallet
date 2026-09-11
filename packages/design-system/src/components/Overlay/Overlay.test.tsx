import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Overlay } from ".";
import { overlayStyle } from "./overlay.css";

describe("Overlay", () => {
    it("should render the overlay element", () => {
        const { container } = render(<Overlay />);
        expect(container.querySelector(`.${overlayStyle}`)).toBeTruthy();
    });

    it("should call onClick when clicked", () => {
        const handleClick = vi.fn();
        const { container } = render(<Overlay onClick={handleClick} />);
        const el = container.querySelector(`.${overlayStyle}`);
        if (!el) throw new Error("overlay not rendered");
        fireEvent.click(el);
        expect(handleClick).toHaveBeenCalledOnce();
    });

    it("should forward className", () => {
        const { container } = render(<Overlay className="custom-overlay" />);
        const el = container.querySelector(`.${overlayStyle}`);
        expect(el?.className).toContain("custom-overlay");
    });
});
