import { renderHook, waitFor } from "@testing-library/react";
import { vi } from "vitest"; // Keep vi from vitest for vi.mock() hoisting
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    test,
} from "../../../tests/vitest-fixtures";
import { useAddToHomeScreenPrompt } from "./useAddToHomeScreenPrompt";

describe("useAddToHomeScreenPrompt", () => {
    let mockPromptEvent: any;

    beforeEach(() => {
        mockPromptEvent = {
            prompt: vi
                .fn()
                .mockResolvedValue({ outcome: "accepted", platform: "web" }),
            platforms: ["web"],
        };

        // Set the prompt event on window
        (window as any).promptEvent = mockPromptEvent;
    });

    afterEach(() => {
        vi.clearAllMocks();
        delete (window as any).promptEvent;
    });

    test("should initialize with null prompt and not installed", () => {
        const { result } = renderHook(() => useAddToHomeScreenPrompt());

        expect(result.current.prompt).toBeNull();
        expect(result.current.isInstalled).toBe(false);
        expect(result.current.outcome).toBeNull();
    });

    test("should capture prompt from window.promptEvent", async () => {
        const { result } = renderHook(() => useAddToHomeScreenPrompt());

        await waitFor(
            () => {
                expect(result.current.prompt).toBe(mockPromptEvent);
            },
            { timeout: 3000 }
        );
    });

    test("should clear prompt after launching installation", async () => {
        const { result } = renderHook(() => useAddToHomeScreenPrompt());

        await waitFor(() => {
            expect(result.current.prompt).toBe(mockPromptEvent);
        });

        await result.current.launchInstallation();

        await waitFor(() => {
            expect(result.current.prompt).toBeNull();
        });
    });

    test("should set outcome after installation", async () => {
        const { result } = renderHook(() => useAddToHomeScreenPrompt());

        await waitFor(() => {
            expect(result.current.prompt).toBe(mockPromptEvent);
        });

        await result.current.launchInstallation();

        await waitFor(() => {
            expect(result.current.outcome).toBe("accepted");
        });
    });

    test("should throw error when launching without prompt", async () => {
        const { result } = renderHook(() => useAddToHomeScreenPrompt());

        await expect(result.current.launchInstallation()).rejects.toThrow(
            'Tried installing before browser sent "beforeinstallprompt" event'
        );
    });

    test("should call prompt on the event", async () => {
        const { result } = renderHook(() => useAddToHomeScreenPrompt());

        await waitFor(() => {
            expect(result.current.prompt).toBe(mockPromptEvent);
        });

        await result.current.launchInstallation();

        expect(mockPromptEvent.prompt).toHaveBeenCalledTimes(1);
    });

    test("should handle appinstalled event", async () => {
        const { result } = renderHook(() => useAddToHomeScreenPrompt());

        // Simulate appinstalled event
        const installEvent = new Event("appinstalled");
        window.dispatchEvent(installEvent);

        await waitFor(() => {
            expect(result.current.isInstalled).toBe(true);
        });
    });

    test("should clean up event listeners on unmount", () => {
        const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");

        const { unmount } = renderHook(() => useAddToHomeScreenPrompt());

        unmount();

        expect(removeEventListenerSpy).toHaveBeenCalledWith(
            "appinstalled",
            expect.any(Function)
        );
    });

    test("should handle dismissed outcome", async () => {
        const dismissedPromptEvent = {
            prompt: vi
                .fn()
                .mockResolvedValue({ outcome: "dismissed", platform: "web" }),
            platforms: ["web"],
        };

        (window as any).promptEvent = dismissedPromptEvent;

        const { result } = renderHook(() => useAddToHomeScreenPrompt());

        await waitFor(() => {
            expect(result.current.prompt).toBe(dismissedPromptEvent);
        });

        await result.current.launchInstallation();

        await waitFor(() => {
            expect(result.current.outcome).toBe("dismissed");
        });
    });

    test("should handle promptEvent appearing after initial render", async () => {
        // Start without promptEvent
        delete (window as any).promptEvent;

        const { result } = renderHook(() => useAddToHomeScreenPrompt());

        // Initially should be null
        expect(result.current.prompt).toBeNull();

        // Add promptEvent after a delay
        await new Promise((resolve) => setTimeout(resolve, 600));
        (window as any).promptEvent = mockPromptEvent;

        // Should eventually capture it
        await waitFor(
            () => {
                expect(result.current.prompt).toBe(mockPromptEvent);
            },
            { timeout: 2000 }
        );
    });

    test("should stop polling after timeout", async () => {
        delete (window as any).promptEvent;

        const clearIntervalSpy = vi.spyOn(global, "clearInterval");

        renderHook(() => useAddToHomeScreenPrompt());

        // Wait for timeout (5 seconds)
        await new Promise((resolve) => setTimeout(resolve, 5100));

        // Should have called clearInterval for the timeout
        expect(clearIntervalSpy).toHaveBeenCalled();

        clearIntervalSpy.mockRestore();
    });

    test("should clean up interval and timeout on unmount", () => {
        delete (window as any).promptEvent;

        const clearIntervalSpy = vi.spyOn(global, "clearInterval");
        const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");

        const { unmount } = renderHook(() => useAddToHomeScreenPrompt());

        unmount();

        // Should clean up both interval and timeout
        expect(clearIntervalSpy).toHaveBeenCalled();
        expect(clearTimeoutSpy).toHaveBeenCalled();

        clearIntervalSpy.mockRestore();
        clearTimeoutSpy.mockRestore();
    });

    test("should handle multiple prompt events (only use first one)", async () => {
        const firstPrompt = {
            prompt: vi
                .fn()
                .mockResolvedValue({ outcome: "accepted", platform: "web" }),
            platforms: ["web"],
        };

        (window as any).promptEvent = firstPrompt;

        const { result } = renderHook(() => useAddToHomeScreenPrompt());

        await waitFor(() => {
            expect(result.current.prompt).toBe(firstPrompt);
        });

        // Try to set a different prompt (should not change)
        const secondPrompt = {
            prompt: vi
                .fn()
                .mockResolvedValue({ outcome: "dismissed", platform: "web" }),
            platforms: ["web"],
        };
        (window as any).promptEvent = secondPrompt;

        // Wait a bit to see if it changes
        await new Promise((resolve) => setTimeout(resolve, 600));

        // Should still be the first prompt (interval stops after first capture)
        expect(result.current.prompt).toBe(firstPrompt);
    });
});
