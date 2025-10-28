import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useShareLink } from "./useShareLink";

// Mock wallet-shared
const mockTrackGenericEvent = vi.fn();
vi.mock("@frak-labs/wallet-shared", () => ({
    get trackGenericEvent() {
        return mockTrackGenericEvent;
    },
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
    let queryClient: QueryClient;

    beforeEach(() => {
        queryClient = new QueryClient();
        vi.clearAllMocks();
    });

    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );

    it("should return early if link is null", async () => {
        const { result } = renderHook(() => useShareLink(null), { wrapper });

        await result.current.mutateAsync();

        // Should not call navigator.share or track event
        expect(mockTrackGenericEvent).not.toHaveBeenCalled();
    });

    it("should return early if link is empty string", async () => {
        const { result } = renderHook(() => useShareLink(""), { wrapper });

        await result.current.mutateAsync();

        expect(mockTrackGenericEvent).not.toHaveBeenCalled();
    });

    it("should return early if navigator is undefined", async () => {
        // Temporarily remove navigator
        const originalNavigator = global.navigator;
        // @ts-expect-error - Testing undefined navigator
        delete global.navigator;

        const { result } = renderHook(
            () => useShareLink("https://example.com"),
            {
                wrapper,
            }
        );

        await result.current.mutateAsync();

        expect(mockTrackGenericEvent).not.toHaveBeenCalled();

        // Restore navigator
        global.navigator = originalNavigator;
    });

    it("should return early if navigator.share is not a function", async () => {
        const originalShare = navigator.share;
        // @ts-expect-error - Testing missing share function
        delete navigator.share;

        const { result } = renderHook(
            () => useShareLink("https://example.com"),
            {
                wrapper,
            }
        );

        await result.current.mutateAsync();

        expect(mockTrackGenericEvent).not.toHaveBeenCalled();

        // Restore share function
        if (originalShare) {
            navigator.share = originalShare;
        }
    });

    it("should return early if canShare returns false", async () => {
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
                wrapper,
            }
        );

        await result.current.mutateAsync();

        expect(mockCanShare).toHaveBeenCalledWith({
            title: "Share this link",
            text: "Check this out!",
            url: "https://example.com",
        });
        expect(mockShare).not.toHaveBeenCalled();
        expect(mockTrackGenericEvent).not.toHaveBeenCalled();
    });

    it("should successfully share link and track event", async () => {
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
                wrapper,
            }
        );

        const response = await result.current.mutateAsync();

        expect(mockShare).toHaveBeenCalledWith({
            title: "Share this link",
            text: "Check this out!",
            url: "https://example.com",
        });
        expect(mockTrackGenericEvent).toHaveBeenCalledWith(
            "sharing-share-link",
            { link: "https://example.com" }
        );
        expect(response).toBe("Shared successfully");
    });

    it("should handle share error gracefully", async () => {
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
                wrapper,
            }
        );

        const response = await result.current.mutateAsync();

        expect(mockShare).toHaveBeenCalled();
        expect(mockTrackGenericEvent).not.toHaveBeenCalled();
        expect(consoleWarnSpy).toHaveBeenCalled();
        expect(response).toBeUndefined();

        consoleWarnSpy.mockRestore();
    });
});
