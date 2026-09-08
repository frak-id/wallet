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

    it("should pass an explicit wildcard through to postMessage", () => {
        Object.defineProperty(window, "parent", {
            value: { postMessage: postMessageSpy },
            writable: true,
            configurable: true,
        });

        const event = {
            iframeLifecycle: "show" as const,
        };

        emitLifecycleEvent(event, { targetOrigin: "*" });

        expect(postMessageSpy).toHaveBeenCalledWith(event, "*");
        expect(postMessageSpy).toHaveBeenCalledTimes(1);
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

        expect(() =>
            emitLifecycleEvent(event, { targetOrigin: "*" })
        ).not.toThrow();
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

        emitLifecycleEvent(event, { targetOrigin: "*" });

        expect(consoleWarnSpy).toHaveBeenCalledWith(
            "Unable to post lifecycle event",
            error
        );
    });

    it("should target the supplied origin", () => {
        Object.defineProperty(window, "parent", {
            value: { postMessage: postMessageSpy },
            writable: true,
            configurable: true,
        });

        emitLifecycleEvent(
            { iframeLifecycle: "do-backup", data: { backup: "payload" } },
            { targetOrigin: "https://merchant.example" }
        );

        expect(postMessageSpy).toHaveBeenCalledWith(
            { iframeLifecycle: "do-backup", data: { backup: "payload" } },
            "https://merchant.example"
        );
    });

    it("should honour the supplied origin on the user-activation branch", () => {
        Object.defineProperty(window, "parent", {
            value: { postMessage: postMessageSpy },
            writable: true,
            configurable: true,
        });

        emitLifecycleEvent(
            { iframeLifecycle: "show" as const },
            {
                includeUserActivation: true,
                targetOrigin: "https://merchant.example",
            }
        );

        expect(postMessageSpy).toHaveBeenCalledWith(
            { iframeLifecycle: "show" },
            {
                targetOrigin: "https://merchant.example",
                includeUserActivation: true,
            }
        );
    });
});
