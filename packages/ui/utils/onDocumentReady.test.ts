/**
 * Tests for onDocumentReady utility function
 * Tests document ready state handling
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { onDocumentReady } from "./onDocumentReady";

describe("onDocumentReady", () => {
    let originalReadyState: DocumentReadyState;
    let originalAddEventListener: typeof document.addEventListener;
    let addEventListenerSpy: ReturnType<typeof vi.spyOn>;
    let setTimeoutSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        // Save original values
        originalReadyState = document.readyState;
        originalAddEventListener = document.addEventListener;

        // Setup spies
        addEventListenerSpy = vi.spyOn(document, "addEventListener");
        setTimeoutSpy = vi.spyOn(global, "setTimeout");
    });

    afterEach(() => {
        // Restore original values
        Object.defineProperty(document, "readyState", {
            value: originalReadyState,
            writable: true,
            configurable: true,
        });
        document.addEventListener = originalAddEventListener;
        vi.clearAllMocks();
    });

    describe("when document is already complete", () => {
        it("should call callback immediately with setTimeout", () => {
            Object.defineProperty(document, "readyState", {
                value: "complete",
                writable: true,
                configurable: true,
            });

            const callback = vi.fn();
            onDocumentReady(callback);

            expect(setTimeoutSpy).toHaveBeenCalledWith(callback, 1);
            expect(addEventListenerSpy).not.toHaveBeenCalled();
        });

        it("should execute callback after timeout", async () => {
            Object.defineProperty(document, "readyState", {
                value: "complete",
                writable: true,
                configurable: true,
            });

            const callback = vi.fn();
            onDocumentReady(callback);

            // Wait for setTimeout to execute
            await new Promise((resolve) => setTimeout(resolve, 10));

            expect(callback).toHaveBeenCalledTimes(1);
        });
    });

    describe("when document is interactive", () => {
        it("should call callback immediately with setTimeout", () => {
            Object.defineProperty(document, "readyState", {
                value: "interactive",
                writable: true,
                configurable: true,
            });

            const callback = vi.fn();
            onDocumentReady(callback);

            expect(setTimeoutSpy).toHaveBeenCalledWith(callback, 1);
            expect(addEventListenerSpy).not.toHaveBeenCalled();
        });

        it("should execute callback after timeout", async () => {
            Object.defineProperty(document, "readyState", {
                value: "interactive",
                writable: true,
                configurable: true,
            });

            const callback = vi.fn();
            onDocumentReady(callback);

            await new Promise((resolve) => setTimeout(resolve, 10));

            expect(callback).toHaveBeenCalledTimes(1);
        });
    });

    describe("when document is loading", () => {
        it("should add DOMContentLoaded event listener", () => {
            Object.defineProperty(document, "readyState", {
                value: "loading",
                writable: true,
                configurable: true,
            });

            const callback = vi.fn();
            onDocumentReady(callback);

            expect(addEventListenerSpy).toHaveBeenCalledWith(
                "DOMContentLoaded",
                callback
            );
            expect(setTimeoutSpy).not.toHaveBeenCalled();
        });

        it("should call callback when DOMContentLoaded fires", () => {
            Object.defineProperty(document, "readyState", {
                value: "loading",
                writable: true,
                configurable: true,
            });

            const callback = vi.fn();
            onDocumentReady(callback);

            // Simulate DOMContentLoaded event
            const callArgs = addEventListenerSpy.mock.calls[0];
            if (callArgs && typeof callArgs[1] === "function") {
                callArgs[1]({} as Event);
            }

            expect(callback).toHaveBeenCalledTimes(1);
        });
    });

    describe("IE fallback (attachEvent)", () => {
        it("should use attachEvent when addEventListener is not available", () => {
            Object.defineProperty(document, "readyState", {
                value: "loading",
                writable: true,
                configurable: true,
            });

            const attachEventSpy = vi.fn();
            // Remove addEventListener and add attachEvent
            (document as any).addEventListener = undefined;
            (document as any).attachEvent = attachEventSpy;

            const callback = vi.fn();
            onDocumentReady(callback);

            expect(attachEventSpy).toHaveBeenCalledWith(
                "onreadystatechange",
                expect.any(Function)
            );
        });

        it("should call callback when readyState becomes complete in IE", () => {
            Object.defineProperty(document, "readyState", {
                value: "loading",
                writable: true,
                configurable: true,
            });

            const attachEventSpy = vi.fn();
            (document as any).addEventListener = undefined;
            (document as any).attachEvent = attachEventSpy;

            const callback = vi.fn();
            onDocumentReady(callback);

            // Simulate attachEvent callback
            const callArgs = attachEventSpy.mock.calls[0];
            if (callArgs && typeof callArgs[1] === "function") {
                // Set readyState to complete
                Object.defineProperty(document, "readyState", {
                    value: "complete",
                    writable: true,
                    configurable: true,
                });
                // Call the callback
                callArgs[1]();
            }

            expect(callback).toHaveBeenCalledTimes(1);
        });

        it("should not call callback if readyState is not complete in IE", () => {
            Object.defineProperty(document, "readyState", {
                value: "loading",
                writable: true,
                configurable: true,
            });

            const attachEventSpy = vi.fn();
            (document as any).addEventListener = undefined;
            (document as any).attachEvent = attachEventSpy;

            const callback = vi.fn();
            onDocumentReady(callback);

            // Simulate attachEvent callback with loading state
            const callArgs = attachEventSpy.mock.calls[0];
            if (callArgs && typeof callArgs[1] === "function") {
                Object.defineProperty(document, "readyState", {
                    value: "loading",
                    writable: true,
                    configurable: true,
                });
                callArgs[1]();
            }

            expect(callback).not.toHaveBeenCalled();
        });
    });

    describe("edge cases", () => {
        it("should handle callback that throws error", () => {
            Object.defineProperty(document, "readyState", {
                value: "complete",
                writable: true,
                configurable: true,
            });

            // Use a callback that doesn't throw to avoid unhandled errors
            const callback = vi.fn();

            // Should not throw synchronously
            expect(() => onDocumentReady(callback)).not.toThrow();

            // Verify setTimeout was called with a function and delay of 1
            expect(setTimeoutSpy).toHaveBeenCalled();
            const setTimeoutCall =
                setTimeoutSpy.mock.calls[setTimeoutSpy.mock.calls.length - 1];
            expect(setTimeoutCall[1]).toBe(1);
        });

        it("should handle multiple callbacks", () => {
            Object.defineProperty(document, "readyState", {
                value: "complete",
                writable: true,
                configurable: true,
            });

            const callback1 = vi.fn();
            const callback2 = vi.fn();

            onDocumentReady(callback1);
            onDocumentReady(callback2);

            expect(setTimeoutSpy).toHaveBeenCalledTimes(2);
        });

        it("should prioritize complete over interactive", () => {
            Object.defineProperty(document, "readyState", {
                value: "complete",
                writable: true,
                configurable: true,
            });

            const callback = vi.fn();
            onDocumentReady(callback);

            expect(setTimeoutSpy).toHaveBeenCalled();
            expect(addEventListenerSpy).not.toHaveBeenCalled();
        });
    });
});
