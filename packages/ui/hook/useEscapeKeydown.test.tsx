/**
 * Tests for useEscapeKeydown hook
 * Tests Escape key event handling
 */

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useEscapeKeydown } from "./useEscapeKeydown";

describe("useEscapeKeydown", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should call callback when Escape key is pressed", () => {
        const onEscapeKeyDown = vi.fn();
        renderHook(() => useEscapeKeydown(onEscapeKeyDown));

        const escapeEvent = new KeyboardEvent("keydown", {
            key: "Escape",
            bubbles: true,
        });
        window.dispatchEvent(escapeEvent);

        expect(onEscapeKeyDown).toHaveBeenCalledTimes(1);
        expect(onEscapeKeyDown).toHaveBeenCalledWith(escapeEvent);
    });

    it("should not call callback for other keys", () => {
        const onEscapeKeyDown = vi.fn();
        renderHook(() => useEscapeKeydown(onEscapeKeyDown));

        const enterEvent = new KeyboardEvent("keydown", {
            key: "Enter",
            bubbles: true,
        });
        window.dispatchEvent(enterEvent);

        const spaceEvent = new KeyboardEvent("keydown", {
            key: " ",
            bubbles: true,
        });
        window.dispatchEvent(spaceEvent);

        expect(onEscapeKeyDown).not.toHaveBeenCalled();
    });

    it("should handle undefined callback", () => {
        renderHook(() => useEscapeKeydown(undefined));

        const escapeEvent = new KeyboardEvent("keydown", {
            key: "Escape",
            bubbles: true,
        });

        // Should not throw
        expect(() => window.dispatchEvent(escapeEvent)).not.toThrow();
    });

    it("should remove event listener on unmount", () => {
        const onEscapeKeyDown = vi.fn();
        const { unmount } = renderHook(() => useEscapeKeydown(onEscapeKeyDown));

        // Verify listener is active
        const escapeEvent = new KeyboardEvent("keydown", {
            key: "Escape",
            bubbles: true,
        });
        window.dispatchEvent(escapeEvent);
        expect(onEscapeKeyDown).toHaveBeenCalledTimes(1);

        // Unmount
        unmount();

        // Listener should be removed - callback should not be called
        window.dispatchEvent(escapeEvent);
        expect(onEscapeKeyDown).toHaveBeenCalledTimes(1);
    });

    it("should update callback when it changes", () => {
        const firstCallback = vi.fn();
        const { rerender } = renderHook(
            ({ callback }) => useEscapeKeydown(callback),
            {
                initialProps: { callback: firstCallback },
            }
        );

        const escapeEvent = new KeyboardEvent("keydown", {
            key: "Escape",
            bubbles: true,
        });
        window.dispatchEvent(escapeEvent);

        expect(firstCallback).toHaveBeenCalledTimes(1);

        // Update callback
        const secondCallback = vi.fn();
        rerender({ callback: secondCallback });

        window.dispatchEvent(escapeEvent);

        // First callback should not be called again
        expect(firstCallback).toHaveBeenCalledTimes(1);
        // Second callback should be called
        expect(secondCallback).toHaveBeenCalledTimes(1);
    });

    it("should handle multiple Escape key presses", () => {
        const onEscapeKeyDown = vi.fn();
        renderHook(() => useEscapeKeydown(onEscapeKeyDown));

        const escapeEvent1 = new KeyboardEvent("keydown", {
            key: "Escape",
            bubbles: true,
        });
        const escapeEvent2 = new KeyboardEvent("keydown", {
            key: "Escape",
            bubbles: true,
        });
        const escapeEvent3 = new KeyboardEvent("keydown", {
            key: "Escape",
            bubbles: true,
        });

        window.dispatchEvent(escapeEvent1);
        window.dispatchEvent(escapeEvent2);
        window.dispatchEvent(escapeEvent3);

        expect(onEscapeKeyDown).toHaveBeenCalledTimes(3);
    });

    it("should handle case-sensitive key matching", () => {
        const onEscapeKeyDown = vi.fn();
        renderHook(() => useEscapeKeydown(onEscapeKeyDown));

        // "Escape" should match
        const escapeEvent = new KeyboardEvent("keydown", {
            key: "Escape",
            bubbles: true,
        });
        window.dispatchEvent(escapeEvent);
        expect(onEscapeKeyDown).toHaveBeenCalledTimes(1);

        // "escape" (lowercase) should not match
        const lowercaseEvent = new KeyboardEvent("keydown", {
            key: "escape",
            bubbles: true,
        });
        window.dispatchEvent(lowercaseEvent);
        expect(onEscapeKeyDown).toHaveBeenCalledTimes(1);
    });

    it("should handle different key codes for Escape", () => {
        const onEscapeKeyDown = vi.fn();
        renderHook(() => useEscapeKeydown(onEscapeKeyDown));

        // Create event with keyCode 27 (Escape key code)
        const escapeEvent = new KeyboardEvent("keydown", {
            key: "Escape",
            code: "Escape",
            keyCode: 27,
            bubbles: true,
        });
        window.dispatchEvent(escapeEvent);

        expect(onEscapeKeyDown).toHaveBeenCalledTimes(1);
    });

    it("should pass the event object to callback", () => {
        const onEscapeKeyDown = vi.fn();
        renderHook(() => useEscapeKeydown(onEscapeKeyDown));

        const escapeEvent = new KeyboardEvent("keydown", {
            key: "Escape",
            bubbles: true,
        });
        window.dispatchEvent(escapeEvent);

        expect(onEscapeKeyDown).toHaveBeenCalledWith(
            expect.objectContaining({
                key: "Escape",
                type: "keydown",
            })
        );
    });

    it("should handle rapid key presses", () => {
        const onEscapeKeyDown = vi.fn();
        renderHook(() => useEscapeKeydown(onEscapeKeyDown));

        // Simulate rapid Escape key presses
        for (let i = 0; i < 10; i++) {
            const escapeEvent = new KeyboardEvent("keydown", {
                key: "Escape",
                bubbles: true,
            });
            window.dispatchEvent(escapeEvent);
        }

        expect(onEscapeKeyDown).toHaveBeenCalledTimes(10);
    });
});
