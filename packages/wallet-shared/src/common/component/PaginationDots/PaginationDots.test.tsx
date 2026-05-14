import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PaginationDots } from "./index";

describe("PaginationDots", () => {
    it("renders nothing when count <= 1", () => {
        const { container } = render(
            <PaginationDots count={1} currentIndex={0} onSelect={vi.fn()} />
        );
        expect(container.firstChild).toBeNull();
    });

    it("renders nothing when count is 0", () => {
        const { container } = render(
            <PaginationDots count={0} currentIndex={0} onSelect={vi.fn()} />
        );
        expect(container.firstChild).toBeNull();
    });

    it("renders N buttons for count=N", () => {
        render(
            <PaginationDots count={3} currentIndex={0} onSelect={vi.fn()} />
        );
        expect(screen.getAllByRole("button")).toHaveLength(3);
    });

    it("marks the active dot with aria-current", () => {
        render(
            <PaginationDots count={3} currentIndex={1} onSelect={vi.fn()} />
        );
        const buttons = screen.getAllByRole("button");
        expect(buttons[0]).not.toHaveAttribute("aria-current");
        expect(buttons[1]).toHaveAttribute("aria-current", "true");
        expect(buttons[2]).not.toHaveAttribute("aria-current");
    });

    it("calls onSelect with the clicked index", () => {
        const onSelect = vi.fn();
        render(
            <PaginationDots count={3} currentIndex={0} onSelect={onSelect} />
        );
        fireEvent.click(screen.getAllByRole("button")[2]);
        expect(onSelect).toHaveBeenCalledWith(2);
    });

    it("does not call onSelect when clicking the active dot", () => {
        const onSelect = vi.fn();
        render(
            <PaginationDots count={3} currentIndex={1} onSelect={onSelect} />
        );
        fireEvent.click(screen.getAllByRole("button")[1]);
        expect(onSelect).not.toHaveBeenCalled();
    });

    it("activates via keyboard (Enter on focused button fires onSelect)", () => {
        const onSelect = vi.fn();
        render(
            <PaginationDots count={3} currentIndex={0} onSelect={onSelect} />
        );
        const target = screen.getAllByRole("button")[2];
        target.focus();
        fireEvent.keyDown(target, { key: "Enter" });
        fireEvent.keyUp(target, { key: "Enter" });
        fireEvent.click(target);
        expect(onSelect).toHaveBeenCalledWith(2);
    });

    it("uses ariaLabelTemplate when provided", () => {
        render(
            <PaginationDots
                count={2}
                currentIndex={0}
                onSelect={vi.fn()}
                ariaLabelTemplate={(i, n) => `Page ${i + 1}/${n}`}
            />
        );
        expect(screen.getByLabelText("Page 1/2")).toBeInTheDocument();
        expect(screen.getByLabelText("Page 2/2")).toBeInTheDocument();
    });
});
