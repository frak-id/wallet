import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSendPing } from "./useSendPing";

describe("useSendPing", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        global.fetch = vi.fn() as unknown as typeof fetch;
    });

    it("should return a memoized async function", () => {
        const { result } = renderHook(() => useSendPing());

        expect(result.current).toBeDefined();
        expect(typeof result.current.then).toBe("function"); // Check it's a Promise
    });

    it("should call fetch with correct parameters", async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({}),
        });
        global.fetch = mockFetch as unknown as typeof fetch;

        const mockUserAgent = "Mozilla/5.0 Test Agent";
        Object.defineProperty(navigator, "userAgent", {
            value: mockUserAgent,
            configurable: true,
        });

        const { result } = renderHook(() => useSendPing());

        // Trigger the fetch
        await result.current;

        expect(mockFetch).toHaveBeenCalledWith("https://metrics.frak.id/ping", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ ua: mockUserAgent }),
        });
    });

    it("should return the same memoized function on re-render", () => {
        const { result, rerender } = renderHook(() => useSendPing());

        const firstResult = result.current;
        rerender();
        const secondResult = result.current;

        expect(firstResult).toBe(secondResult);
    });

    it("should handle fetch without awaiting response", () => {
        const mockFetch = vi.fn();
        global.fetch = mockFetch as unknown as typeof fetch;

        renderHook(() => useSendPing());

        // The hook doesn't await the fetch, so it should be called immediately
        expect(mockFetch).toHaveBeenCalled();
    });
});
