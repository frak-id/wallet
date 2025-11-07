import { renderHook, waitFor } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCopyToClipboard } from "./useCopyToClipboard";

describe("useCopyToClipboard", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Mock navigator.clipboard
        Object.defineProperty(global.navigator, "clipboard", {
            value: {
                writeText: vi.fn().mockResolvedValue(undefined),
            },
            writable: true,
            configurable: true,
        });
        global.window.isSecureContext = true;
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("should return initial state", () => {
        const { result } = renderHook(() => useCopyToClipboard());

        expect(result.current.copied).toBe(false);
        expect(result.current.copy).toBeDefined();
    });

    it("should copy text using clipboard API when available", async () => {
        const { result } = renderHook(() => useCopyToClipboard());

        const promise = result.current.copy("test text");
        await promise;

        expect(navigator.clipboard.writeText).toHaveBeenCalledWith("test text");
        await waitFor(() => {
            expect(result.current.copied).toBe(true);
        });
    });

    it("should accept custom successDuration option", () => {
        // Test that the hook accepts the option without error
        const { result } = renderHook(() =>
            useCopyToClipboard({ successDuration: 1000 })
        );

        expect(result.current.copy).toBeDefined();
        expect(result.current.copied).toBe(false);
    });

    it("should fallback to execCommand when clipboard API is not available", async () => {
        // Remove clipboard API
        delete (global.navigator as any).clipboard;
        global.window.isSecureContext = false;

        // Mock document.execCommand
        const execCommandSpy = vi.fn().mockReturnValue(true);
        Object.defineProperty(document, "execCommand", {
            value: execCommandSpy,
            writable: true,
            configurable: true,
        });

        const { result } = renderHook(() => useCopyToClipboard());

        const promise = result.current.copy("test text");
        await promise;

        expect(execCommandSpy).toHaveBeenCalledWith("copy");
        // Wait for state update
        await waitFor(() => {
            expect(result.current.copied).toBe(true);
        });
    });

    it("should handle execCommand failure", async () => {
        delete (global.navigator as any).clipboard;
        global.window.isSecureContext = false;

        // execCommand throws an error (not just returns false)
        const execCommandSpy = vi.fn().mockImplementation(() => {
            throw new Error("execCommand failed");
        });
        Object.defineProperty(document, "execCommand", {
            value: execCommandSpy,
            writable: true,
            configurable: true,
        });

        const consoleErrorSpy = vi
            .spyOn(console, "error")
            .mockImplementation(() => {});

        const { result } = renderHook(() => useCopyToClipboard());

        const resultValue = await result.current.copy("test text");

        expect(resultValue).toBe(false);
        expect(result.current.copied).toBe(false);
        expect(consoleErrorSpy).toHaveBeenCalled();

        consoleErrorSpy.mockRestore();
    });

    it("should handle clipboard API error", async () => {
        const clipboardError = new Error("Clipboard error");
        vi.mocked(navigator.clipboard.writeText).mockRejectedValue(
            clipboardError
        );

        const { result } = renderHook(() => useCopyToClipboard());

        const resultValue = await result.current.copy("test text");

        expect(resultValue).toBe(false);
        expect(result.current.copied).toBe(false);
    });

    it("should create and remove textarea element for fallback", async () => {
        delete (global.navigator as any).clipboard;
        global.window.isSecureContext = false;

        const execCommandSpy = vi.fn().mockReturnValue(true);
        Object.defineProperty(document, "execCommand", {
            value: execCommandSpy,
            writable: true,
        });

        const createElementSpy = vi.spyOn(document, "createElement");
        const appendChildSpy = vi.spyOn(document.body, "appendChild");
        const removeSpy = vi.spyOn(Element.prototype, "remove");

        const { result } = renderHook(() => useCopyToClipboard());

        await result.current.copy("test text");

        expect(createElementSpy).toHaveBeenCalledWith("textarea");
        expect(appendChildSpy).toHaveBeenCalled();
        expect(removeSpy).toHaveBeenCalled();
    });
});
