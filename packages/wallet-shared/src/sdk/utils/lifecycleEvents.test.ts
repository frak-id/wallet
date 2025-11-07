import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emitLifecycleEvent } from "./lifecycleEvents";

describe("emitLifecycleEvent", () => {
    let originalParent: Window;
    let postMessageSpy: ReturnType<typeof vi.fn>;
    let consoleWarnSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        originalParent = window.parent;
        postMessageSpy = vi.fn();
        consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
        Object.defineProperty(window, "parent", {
            value: originalParent,
            writable: true,
            configurable: true,
        });
    });

    it("should post message to parent window with wildcard origin", () => {
        Object.defineProperty(window, "parent", {
            value: { postMessage: postMessageSpy },
            writable: true,
            configurable: true,
        });

        const event = {
            iframeLifecycle: "show" as const,
        };

        emitLifecycleEvent(event);

        expect(postMessageSpy).toHaveBeenCalledWith(event, "*");
        expect(postMessageSpy).toHaveBeenCalledTimes(1);
    });

    it("should handle different lifecycle event types", () => {
        Object.defineProperty(window, "parent", {
            value: { postMessage: postMessageSpy },
            writable: true,
            configurable: true,
        });

        const events = [
            { iframeLifecycle: "show" as const },
            { iframeLifecycle: "hide" as const },
        ];

        for (const event of events) {
            emitLifecycleEvent(event);
        }

        expect(postMessageSpy).toHaveBeenCalledTimes(2);
        expect(postMessageSpy).toHaveBeenNthCalledWith(1, events[0], "*");
        expect(postMessageSpy).toHaveBeenNthCalledWith(2, events[1], "*");
    });

    it("should handle missing parent window gracefully", () => {
        Object.defineProperty(window, "parent", {
            value: null,
            writable: true,
            configurable: true,
        });

        const event = {
            iframeLifecycle: "show" as const,
        };

        expect(() => emitLifecycleEvent(event)).not.toThrow();
        expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it("should log warning when postMessage throws error", () => {
        const error = new Error("postMessage failed");
        Object.defineProperty(window, "parent", {
            value: {
                postMessage: vi.fn(() => {
                    throw error;
                }),
            },
            writable: true,
            configurable: true,
        });

        const event = {
            iframeLifecycle: "show" as const,
        };

        emitLifecycleEvent(event);

        expect(consoleWarnSpy).toHaveBeenCalledWith(
            "Unable to post lifecycle event",
            error
        );
    });
});
