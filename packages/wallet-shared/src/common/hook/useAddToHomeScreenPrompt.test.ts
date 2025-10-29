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
});
