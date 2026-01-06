import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { useMediaQuery } from "./useMediaQuery";

describe("useMediaQuery", () => {
    let matchMediaMock: Mock<(query: string) => MediaQueryList>;
    let mediaQueryListMock: {
        matches: boolean;
        media: string;
        addEventListener: Mock;
        removeEventListener: Mock;
        onchange: null | ((event: MediaQueryListEvent) => void);
    };

    beforeEach(() => {
        // Reset mocks
        vi.clearAllMocks();

        // Create a mock MediaQueryList
        mediaQueryListMock = {
            matches: false,
            media: "(min-width: 768px)",
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            onchange: null,
        };

        // Mock window.matchMedia
        matchMediaMock = vi.fn((query: string) => {
            mediaQueryListMock.media = query;
            return mediaQueryListMock as unknown as MediaQueryList;
        });

        // Ensure window exists and define matchMedia
        if (typeof window !== "undefined") {
            Object.defineProperty(window, "matchMedia", {
                writable: true,
                configurable: true,
                value: matchMediaMock,
            });
        }
    });

    it("should return false when media query does not match", () => {
        mediaQueryListMock.matches = false;

        const { result } = renderHook(() =>
            useMediaQuery("(min-width: 768px)")
        );

        expect(result.current).toBe(false);
        expect(matchMediaMock).toHaveBeenCalledWith("(min-width: 768px)");
    });

    it("should return true when media query matches", () => {
        mediaQueryListMock.matches = true;

        const { result } = renderHook(() =>
            useMediaQuery("(min-width: 768px)")
        );

        expect(result.current).toBe(true);
        expect(matchMediaMock).toHaveBeenCalledWith("(min-width: 768px)");
    });

    it("should add event listener for media query changes", () => {
        renderHook(() => useMediaQuery("(min-width: 768px)"));

        expect(mediaQueryListMock.addEventListener).toHaveBeenCalledWith(
            "change",
            expect.any(Function)
        );
        expect(mediaQueryListMock.addEventListener).toHaveBeenCalledTimes(1);
    });

    it("should update matches when media query changes", async () => {
        const { result } = renderHook(() =>
            useMediaQuery("(min-width: 768px)")
        );

        expect(result.current).toBe(false);

        // Get the change handler
        const changeHandler =
            mediaQueryListMock.addEventListener.mock.calls[0][1];

        // Simulate media query change
        mediaQueryListMock.matches = true;
        changeHandler({ matches: true } as MediaQueryListEvent);

        await waitFor(() => {
            expect(result.current).toBe(true);
        });
    });

    it("should remove event listener on unmount", () => {
        const { unmount } = renderHook(() =>
            useMediaQuery("(min-width: 768px)")
        );

        const changeHandler =
            mediaQueryListMock.addEventListener.mock.calls[0][1];

        unmount();

        expect(mediaQueryListMock.removeEventListener).toHaveBeenCalledWith(
            "change",
            changeHandler
        );
        expect(mediaQueryListMock.removeEventListener).toHaveBeenCalledTimes(1);
    });

    it("should handle different media queries", () => {
        const queries = [
            "(max-width: 600px)",
            "(min-width: 1024px)",
            "(prefers-color-scheme: dark)",
            "(orientation: landscape)",
        ];

        queries.forEach((query) => {
            const { unmount } = renderHook(() => useMediaQuery(query));
            expect(matchMediaMock).toHaveBeenCalledWith(query);
            unmount();
        });
    });

    // Note: SSR tests are skipped because the hook only checks `typeof window !== "undefined"`
    // and doesn't check if `window.matchMedia` exists. The hook would throw an error
    // if `matchMedia` doesn't exist, so we can't test that scenario without modifying
    // the hook implementation.

    it("should update when query changes", () => {
        const { rerender } = renderHook(({ query }) => useMediaQuery(query), {
            initialProps: { query: "(min-width: 768px)" },
        });

        expect(matchMediaMock).toHaveBeenCalledWith("(min-width: 768px)");

        // Change query
        rerender({ query: "(max-width: 600px)" });

        expect(matchMediaMock).toHaveBeenCalledWith("(max-width: 600px)");
    });

    it("should handle multiple rapid changes", async () => {
        const { result } = renderHook(() =>
            useMediaQuery("(min-width: 768px)")
        );

        const changeHandler =
            mediaQueryListMock.addEventListener.mock.calls[0][1];

        // Simulate multiple rapid changes
        mediaQueryListMock.matches = true;
        changeHandler({ matches: true } as MediaQueryListEvent);

        await waitFor(() => {
            expect(result.current).toBe(true);
        });

        mediaQueryListMock.matches = false;
        changeHandler({ matches: false } as MediaQueryListEvent);

        await waitFor(() => {
            expect(result.current).toBe(false);
        });
    });

    it("should memoize MediaQueryList for same query", () => {
        const { rerender } = renderHook(() =>
            useMediaQuery("(min-width: 768px)")
        );

        const firstCallCount = matchMediaMock.mock.calls.length;

        // Rerender with same query
        rerender();

        // Should not create new MediaQueryList
        expect(matchMediaMock.mock.calls.length).toBe(firstCallCount);
    });
});
