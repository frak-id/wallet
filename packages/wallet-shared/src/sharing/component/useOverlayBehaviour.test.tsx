import { fireEvent, render, screen } from "@testing-library/react";
import { useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { useOverlayBehaviour } from "./useOverlayBehaviour";

// mirrors the real screens: an inline `onDismiss` closure, rebuilt every render
function Overlay({
    enabled = true,
    onDismiss,
}: {
    enabled?: boolean;
    onDismiss: () => void;
}) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [, forceRender] = useState(0);

    useOverlayBehaviour({
        enabled,
        onDismiss: () => onDismiss(),
        containerRef,
    });

    return (
        <div ref={containerRef} tabIndex={-1}>
            <button type="button">first</button>
            <button type="button">second</button>
            <button
                type="button"
                data-testid="rerender"
                onClick={() => forceRender((n) => n + 1)}
            >
                rerender
            </button>
        </div>
    );
}

describe("useOverlayBehaviour", () => {
    it("dismisses on Escape", () => {
        const onDismiss = vi.fn();
        render(<Overlay onDismiss={onDismiss} />);

        fireEvent.keyDown(document, { key: "Escape" });

        expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it("does nothing when disabled — the host owns dismissal", () => {
        const onDismiss = vi.fn();
        render(<Overlay enabled={false} onDismiss={onDismiss} />);

        fireEvent.keyDown(document, { key: "Escape" });

        expect(onDismiss).not.toHaveBeenCalled();
    });

    it("moves focus into the dialog on open", () => {
        render(<Overlay onDismiss={vi.fn()} />);

        expect(screen.getByText("first")).toHaveFocus();
    });

    it("does NOT steal focus back on an unrelated re-render", () => {
        render(<Overlay onDismiss={vi.fn()} />);

        const second = screen.getByText("second");
        second.focus();
        expect(second).toHaveFocus();

        fireEvent.click(screen.getByTestId("rerender"));

        expect(second).toHaveFocus();
    });

    it("still calls the latest onDismiss after a re-render", () => {
        const onDismiss = vi.fn();
        render(<Overlay onDismiss={onDismiss} />);

        fireEvent.click(screen.getByTestId("rerender"));
        fireEvent.keyDown(document, { key: "Escape" });

        expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it("stops listening once unmounted", () => {
        const onDismiss = vi.fn();
        const { unmount } = render(<Overlay onDismiss={onDismiss} />);

        unmount();
        fireEvent.keyDown(document, { key: "Escape" });

        expect(onDismiss).not.toHaveBeenCalled();
    });

    it("wraps Tab at the end of the dialog", () => {
        render(<Overlay onDismiss={vi.fn()} />);

        screen.getByTestId("rerender").focus();
        fireEvent.keyDown(document, { key: "Tab" });

        expect(screen.getByText("first")).toHaveFocus();
    });

    it("wraps Shift+Tab at the start of the dialog", () => {
        render(<Overlay onDismiss={vi.fn()} />);

        screen.getByText("first").focus();
        fireEvent.keyDown(document, { key: "Tab", shiftKey: true });

        expect(screen.getByTestId("rerender")).toHaveFocus();
    });
});
