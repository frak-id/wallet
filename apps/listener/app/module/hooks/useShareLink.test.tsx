import { renderHook } from "@testing-library/react";
import { vi } from "vitest"; // Keep vi from vitest for vi.mock() hoisting
import { beforeEach, describe, expect, test } from "@/tests/fixtures";
import { useShareLink } from "./useShareLink";

// Mock wallet-shared
const mockTrackEvent = vi.fn();
vi.mock("@frak-labs/wallet-shared", () => ({
    get trackEvent() {
        return mockTrackEvent;
    },
}));

// Mock useTrackSharing
const mockTrackSharing = vi.fn().mockResolvedValue(undefined);
vi.mock("./useTrackSharing", () => ({
    useTrackSharing: () => ({
        mutateAsync: mockTrackSharing,
    }),
}));

// Mock ListenerUiProvider
const mockT = vi.fn((key: string) => {
    const translations: Record<string, string> = {
        "sharing.title": "Share this link",
        "sharing.text": "Check this out!",
        "sharing.btn.shareSuccess": "Shared successfully",
    };
    return translations[key] || key;
});

vi.mock("../providers/ListenerUiProvider", () => ({
    useListenerTranslation: () => ({ t: mockT }),
}));

describe("useShareLink", () => {
    beforeEach(({ queryWrapper }) => {
        queryWrapper.client.clear();
        vi.clearAllMocks();
    });

    test("should return early if link is null", async ({ queryWrapper }) => {
        const { result } = renderHook(() => useShareLink(null), {
            wrapper: queryWrapper.wrapper,
        });

        await result.current.mutateAsync();

        // Should not call navigator.share or track event
        expect(mockTrackEvent).not.toHaveBeenCalled();
    });

    test("should return early if link is empty string", async ({
        queryWrapper,
    }) => {
        const { result } = renderHook(() => useShareLink(""), {
            wrapper: queryWrapper.wrapper,
        });

        await result.current.mutateAsync();

        expect(mockTrackEvent).not.toHaveBeenCalled();
    });

    test("should return early if navigator is undefined", async ({
        queryWrapper,
    }) => {
        // Temporarily remove navigator
        const originalNavigator = global.navigator;
        // @ts-expect-error - Testing undefined navigator
        delete global.navigator;

        const { result } = renderHook(
            () => useShareLink("https://example.com"),
            {
                wrapper: queryWrapper.wrapper,
            }
        );

        await result.current.mutateAsync();

        expect(mockTrackEvent).not.toHaveBeenCalled();

        // Restore navigator
        global.navigator = originalNavigator;
    });

    test("should return early if navigator.share is not a function", async ({
        queryWrapper,
    }) => {
        const originalShare = navigator.share;
        // @ts-expect-error - Testing missing share function
        delete navigator.share;

        const { result } = renderHook(
            () => useShareLink("https://example.com"),
            {
                wrapper: queryWrapper.wrapper,
            }
        );

        await result.current.mutateAsync();

        expect(mockTrackEvent).not.toHaveBeenCalled();

        // Restore share function
        if (originalShare) {
            navigator.share = originalShare;
        }
    });

    test("should return early if canShare returns false", async ({
        queryWrapper,
    }) => {
        const mockShare = vi.fn();
        const mockCanShare = vi.fn().mockReturnValue(false);

        Object.defineProperty(navigator, "share", {
            value: mockShare,
            writable: true,
            configurable: true,
        });
        Object.defineProperty(navigator, "canShare", {
            value: mockCanShare,
            writable: true,
            configurable: true,
        });

        const { result } = renderHook(
            () => useShareLink("https://example.com"),
            {
                wrapper: queryWrapper.wrapper,
            }
        );

        await result.current.mutateAsync();

        expect(mockCanShare).toHaveBeenCalledWith({
            title: "Share this link",
            text: "Check this out!",
            url: "https://example.com",
        });
        expect(mockShare).not.toHaveBeenCalled();
        expect(mockTrackEvent).not.toHaveBeenCalled();
    });

    test("should successfully share link and track event", async ({
        queryWrapper,
    }) => {
        const mockShare = vi.fn().mockResolvedValue(undefined);
        const mockCanShare = vi.fn().mockReturnValue(true);

        Object.defineProperty(navigator, "share", {
            value: mockShare,
            writable: true,
            configurable: true,
        });
        Object.defineProperty(navigator, "canShare", {
            value: mockCanShare,
            writable: true,
            configurable: true,
        });

        const { result } = renderHook(
            () => useShareLink("https://example.com"),
            {
                wrapper: queryWrapper.wrapper,
            }
        );

        const response = await result.current.mutateAsync();

        expect(mockShare).toHaveBeenCalledWith({
            title: "Share this link",
            text: "Check this out!",
            url: "https://example.com",
        });
        expect(mockTrackEvent).toHaveBeenCalledWith("sharing_link_shared", {
            link: "https://example.com",
        });
        expect(response).toBe("Shared successfully");
    });

    test("should handle share error gracefully", async ({ queryWrapper }) => {
        const mockShare = vi
            .fn()
            .mockRejectedValue(new Error("User cancelled"));
        const mockCanShare = vi.fn().mockReturnValue(true);
        const consoleWarnSpy = vi
            .spyOn(console, "warn")
            .mockImplementation(() => {});

        Object.defineProperty(navigator, "share", {
            value: mockShare,
            writable: true,
            configurable: true,
        });
        Object.defineProperty(navigator, "canShare", {
            value: mockCanShare,
            writable: true,
            configurable: true,
        });

        const { result } = renderHook(
            () => useShareLink("https://example.com"),
            {
                wrapper: queryWrapper.wrapper,
            }
        );

        const response = await result.current.mutateAsync();

        expect(mockShare).toHaveBeenCalled();
        expect(mockTrackEvent).not.toHaveBeenCalled();
        expect(consoleWarnSpy).toHaveBeenCalled();
        expect(response).toBeUndefined();

        consoleWarnSpy.mockRestore();
    });
});
