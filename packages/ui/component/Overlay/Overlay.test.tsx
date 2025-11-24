import { fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Overlay } from "./index";

describe("Overlay", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should render overlay", () => {
        const { container } = render(<Overlay />);
        const overlay = container.querySelector("div");
        expect(overlay).toBeInTheDocument();
    });

    it("should call onOpenChange when clicked", () => {
        const handleOpenChange = vi.fn();
        const { container } = render(
            <Overlay onOpenChange={handleOpenChange} />
        );

        const overlay = container.querySelector("div");
        fireEvent.click(overlay!);

        expect(handleOpenChange).toHaveBeenCalledWith(false);
    });

    it("should not call onOpenChange when prop is not provided", () => {
        const { container } = render(<Overlay />);

        const overlay = container.querySelector("div");
        fireEvent.click(overlay!);

        // Should not throw error
        expect(overlay).toBeInTheDocument();
    });

    it("should call onOpenChange when escape key is pressed", () => {
        const handleOpenChange = vi.fn();
        render(<Overlay onOpenChange={handleOpenChange} />);

        // Simulate escape key press - useEscapeKeydown hook listens to window keydown
        fireEvent.keyDown(window, { key: "Escape" });

        expect(handleOpenChange).toHaveBeenCalledWith(false);
    });

    it("should have overlay className", () => {
        const { container } = render(<Overlay />);
        const overlay = container.querySelector("div");
        expect(overlay?.className).toContain("overlay");
    });
});
