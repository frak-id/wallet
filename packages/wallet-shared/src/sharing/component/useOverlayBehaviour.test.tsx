import { fireEvent, render, screen } from "@testing-library/react";
import { useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { useOverlayBehaviour } from "./useOverlayBehaviour";

/**
 * Mirrors how the real screens use this: an inline `onDismiss` closure, rebuilt
 * on every render, because both consumers build their outcome handlers as
 * object literals.
 */
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
        // The regression this exists for: `onDismiss` is a fresh closure every
        // render, so listing it as an effect dependency re-ran the focus move
        // on every background re-render (the reward query resolving, a product
        // being selected, a share starting) and yanked focus away from
        // whatever the user was on.
        render(<Overlay onDismiss={vi.fn()} />);

        const second = screen.getByText("second");
        second.focus();
        expect(second).toHaveFocus();

        fireEvent.click(screen.getByTestId("rerender"));

        expect(second).toHaveFocus();
    });

    it("still calls the latest onDismiss after a re-render", () => {
        // The other half of reading it through a ref: skipping the dependency
        // must not pin the handler to the one captured on mount.
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
