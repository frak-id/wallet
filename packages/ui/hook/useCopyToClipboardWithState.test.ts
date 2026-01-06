import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCopyToClipboardWithState } from "./useCopyToClipboardWithState";

// Mock @uidotdev/usehooks
const mockCopyToClipboard = vi.fn(() => Promise.resolve());

vi.mock("@uidotdev/usehooks", () => ({
    useCopyToClipboard: vi.fn(() => [null, mockCopyToClipboard]),
}));

describe("useCopyToClipboardWithState", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("should return copied state and copy function", () => {
        const { result } = renderHook(() => useCopyToClipboardWithState());

        expect(result.current).toHaveProperty("copied");
        expect(result.current).toHaveProperty("copy");
        expect(typeof result.current.copy).toBe("function");
        expect(result.current.copied).toBe(false);
    });

    it("should set copied to true when copy is called", async () => {
        const { result } = renderHook(() => useCopyToClipboardWithState());

        await act(async () => {
            result.current.copy("0x1234567890123456789012345678901234567890");
        });

        expect(result.current.copied).toBe(true);
        expect(mockCopyToClipboard).toHaveBeenCalledWith(
            "0x1234567890123456789012345678901234567890"
        );
    });

    it("should reset copied to false after 2 seconds", async () => {
        const { result } = renderHook(() => useCopyToClipboardWithState());

        await act(async () => {
            result.current.copy("test-wallet-address");
        });

        expect(result.current.copied).toBe(true);

        // Fast-forward 2 seconds and flush all timers
        await act(async () => {
            vi.advanceTimersByTime(2000);
        });

        // State should be updated after timers are flushed
        expect(result.current.copied).toBe(false);
    });

    it("should not call copyToClipboard if already copied", async () => {
        const { result } = renderHook(() => useCopyToClipboardWithState());

        // First copy
        await act(async () => {
            result.current.copy("test-wallet-1");
        });

        expect(mockCopyToClipboard).toHaveBeenCalledTimes(1);
        expect(result.current.copied).toBe(true);

        // Try to copy again while copied is true
        await act(async () => {
            result.current.copy("test-wallet-2");
        });

        // Should not call copyToClipboard again
        expect(mockCopyToClipboard).toHaveBeenCalledTimes(1);
        expect(result.current.copied).toBe(true);
    });

    it("should allow copy after copied state resets", async () => {
        const { result } = renderHook(() => useCopyToClipboardWithState());

        // First copy
        await act(async () => {
            result.current.copy("test-wallet-1");
        });

        expect(result.current.copied).toBe(true);
        expect(mockCopyToClipboard).toHaveBeenCalledTimes(1);

        // Wait for state to reset
        await act(async () => {
            vi.advanceTimersByTime(2000);
        });

        expect(result.current.copied).toBe(false);

        // Now should be able to copy again
        await act(async () => {
            result.current.copy("test-wallet-2");
        });

        expect(result.current.copied).toBe(true);
        expect(mockCopyToClipboard).toHaveBeenCalledTimes(2);
        expect(mockCopyToClipboard).toHaveBeenLastCalledWith("test-wallet-2");
    });

    it("should handle multiple rapid copy attempts", async () => {
        const { result } = renderHook(() => useCopyToClipboardWithState());

        // First copy
        await act(async () => {
            result.current.copy("wallet-1");
        });

        // Try to copy multiple times rapidly
        await act(async () => {
            result.current.copy("wallet-2");
            result.current.copy("wallet-3");
            result.current.copy("wallet-4");
        });

        // Should only be called once (first call)
        expect(mockCopyToClipboard).toHaveBeenCalledTimes(1);
        expect(mockCopyToClipboard).toHaveBeenCalledWith("wallet-1");
    });

    it("should handle different wallet address formats", async () => {
        const { result } = renderHook(() => useCopyToClipboardWithState());

        const addresses = [
            "0x1234567890123456789012345678901234567890",
            "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
            "wallet-address-string",
            "1234567890",
        ];

        for (const address of addresses) {
            // Wait for previous copy to reset
            await act(async () => {
                vi.advanceTimersByTime(2000);
            });

            await act(async () => {
                result.current.copy(address);
            });

            expect(mockCopyToClipboard).toHaveBeenCalledWith(address);
        }
    });

    it("should reset timer when copy is called again after reset", async () => {
        const { result } = renderHook(() => useCopyToClipboardWithState());

        // First copy
        await act(async () => {
            result.current.copy("wallet-1");
        });

        // Wait 1 second (not full 2 seconds)
        await act(async () => {
            vi.advanceTimersByTime(1000);
        });

        // Copy should still be true
        expect(result.current.copied).toBe(true);

        // Wait the remaining second to reset
        await act(async () => {
            vi.advanceTimersByTime(1000);
        });

        expect(result.current.copied).toBe(false);

        // Now copy again
        await act(async () => {
            result.current.copy("wallet-2");
        });

        expect(result.current.copied).toBe(true);

        // Should reset again after 2 seconds
        await act(async () => {
            vi.advanceTimersByTime(2000);
        });

        expect(result.current.copied).toBe(false);
    });

    it("should handle empty string wallet address", async () => {
        const { result } = renderHook(() => useCopyToClipboardWithState());

        await act(async () => {
            result.current.copy("");
        });

        expect(result.current.copied).toBe(true);
        expect(mockCopyToClipboard).toHaveBeenCalledWith("");
    });

    it("should maintain copied state during the 2 second period", async () => {
        const { result } = renderHook(() => useCopyToClipboardWithState());

        await act(async () => {
            result.current.copy("test-wallet");
        });

        expect(result.current.copied).toBe(true);

        // Check at various points during the 2 second period
        await act(async () => {
            vi.advanceTimersByTime(500);
        });
        expect(result.current.copied).toBe(true);

        await act(async () => {
            vi.advanceTimersByTime(1000);
        });
        expect(result.current.copied).toBe(true);

        await act(async () => {
            vi.advanceTimersByTime(500);
        });

        expect(result.current.copied).toBe(false);
    });
});
