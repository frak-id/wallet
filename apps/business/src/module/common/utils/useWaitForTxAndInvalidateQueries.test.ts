import { renderHook } from "@testing-library/react";
import { guard } from "radash";
import type { Hex } from "viem";
import { waitForTransactionReceipt } from "viem/actions";
import { vi } from "vitest";
import {
    describe,
    expect,
    type TestContext,
    test,
} from "@/tests/vitest-fixtures";
import { useWaitForTxAndInvalidateQueries } from "./useWaitForTxAndInvalidateQueries";

// Mock viem actions
vi.mock("viem/actions", () => ({
    waitForTransactionReceipt: vi.fn(),
}));

// Mock the blockchain provider
vi.mock("@/context/blockchain/provider", () => ({
    viemClient: {},
}));

// Mock radash guard
vi.mock("radash", () => ({
    guard: vi.fn((fn) => fn()),
}));

describe("useWaitForTxAndInvalidateQueries", () => {
    const mockTxHash =
        "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd" as Hex;

    describe("successful transaction waiting", () => {
        test("should wait for transaction and invalidate queries", async ({
            queryWrapper,
        }: TestContext) => {
            vi.mocked(waitForTransactionReceipt).mockResolvedValue({
                status: "success",
            } as any);

            const { result } = renderHook(
                () => useWaitForTxAndInvalidateQueries(),
                { wrapper: queryWrapper.wrapper }
            );

            const waitFn = result.current;

            await waitFn({
                hash: mockTxHash,
                queryKey: ["product", "test"],
            });

            expect(waitForTransactionReceipt).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    hash: mockTxHash,
                    confirmations: 16,
                    retryCount: 16,
                })
            );
        });

        test("should use default 16 confirmations", async ({
            queryWrapper,
        }: TestContext) => {
            vi.mocked(waitForTransactionReceipt).mockResolvedValue({
                status: "success",
            } as any);

            const { result } = renderHook(
                () => useWaitForTxAndInvalidateQueries(),
                { wrapper: queryWrapper.wrapper }
            );

            await result.current({
                hash: mockTxHash,
                queryKey: ["test"],
            });

            expect(waitForTransactionReceipt).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    confirmations: 16,
                    retryCount: 16,
                })
            );
        });

        test("should accept custom confirmation count", async ({
            queryWrapper,
        }: TestContext) => {
            vi.mocked(waitForTransactionReceipt).mockResolvedValue({
                status: "success",
            } as any);

            const { result } = renderHook(
                () => useWaitForTxAndInvalidateQueries(),
                { wrapper: queryWrapper.wrapper }
            );

            await result.current({
                hash: mockTxHash,
                queryKey: ["test"],
                confirmations: 4,
            });

            expect(waitForTransactionReceipt).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    confirmations: 4,
                    retryCount: 4,
                })
            );
        });

        test("should invalidate queries after confirmation", async ({
            queryWrapper,
        }: TestContext) => {
            vi.mocked(waitForTransactionReceipt).mockResolvedValue({
                status: "success",
            } as any);

            const invalidateSpy = vi.spyOn(
                queryWrapper.client,
                "invalidateQueries"
            );

            const { result } = renderHook(
                () => useWaitForTxAndInvalidateQueries(),
                { wrapper: queryWrapper.wrapper }
            );

            await result.current({
                hash: mockTxHash,
                queryKey: ["product", "123"],
            });

            expect(invalidateSpy).toHaveBeenCalledWith({
                queryKey: ["product", "123"],
                exact: false,
            });
        });

        test("should invalidate with non-exact matching", async ({
            queryWrapper,
        }: TestContext) => {
            vi.mocked(waitForTransactionReceipt).mockResolvedValue({
                status: "success",
            } as any);

            const invalidateSpy = vi.spyOn(
                queryWrapper.client,
                "invalidateQueries"
            );

            const { result } = renderHook(
                () => useWaitForTxAndInvalidateQueries(),
                { wrapper: queryWrapper.wrapper }
            );

            await result.current({
                hash: mockTxHash,
                queryKey: ["campaign"],
            });

            expect(invalidateSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    exact: false,
                })
            );
        });
    });

    describe("error handling", () => {
        test("should handle transaction wait errors gracefully", async ({
            queryWrapper,
        }: TestContext) => {
            vi.mocked(waitForTransactionReceipt).mockRejectedValue(
                new Error("Transaction failed")
            );

            // Mock guard to catch and suppress the error
            vi.mocked(guard).mockImplementation(async (fn) => {
                try {
                    return await fn();
                } catch {
                    return undefined;
                }
            });

            const { result } = renderHook(
                () => useWaitForTxAndInvalidateQueries(),
                { wrapper: queryWrapper.wrapper }
            );

            // Should not throw
            await result.current({
                hash: mockTxHash,
                queryKey: ["test"],
            });

            expect(guard).toHaveBeenCalled();
        });

        test("should still invalidate queries even if wait fails", async ({
            queryWrapper,
        }: TestContext) => {
            vi.mocked(waitForTransactionReceipt).mockRejectedValue(
                new Error("Transaction timeout")
            );

            vi.mocked(guard).mockImplementation(async (fn) => {
                try {
                    return await fn();
                } catch {
                    return undefined;
                }
            });

            const invalidateSpy = vi.spyOn(
                queryWrapper.client,
                "invalidateQueries"
            );

            const { result } = renderHook(
                () => useWaitForTxAndInvalidateQueries(),
                { wrapper: queryWrapper.wrapper }
            );

            await result.current({
                hash: mockTxHash,
                queryKey: ["product"],
            });

            // Should still invalidate even if wait failed
            expect(invalidateSpy).toHaveBeenCalled();
        });
    });

    describe("callback stability", () => {
        test("should return stable callback across renders", async ({
            queryWrapper,
        }: TestContext) => {
            vi.mocked(waitForTransactionReceipt).mockResolvedValue({
                status: "success",
            } as any);

            const { result, rerender } = renderHook(
                () => useWaitForTxAndInvalidateQueries(),
                { wrapper: queryWrapper.wrapper }
            );

            const firstCallback = result.current;
            rerender();
            const secondCallback = result.current;

            expect(firstCallback).toBe(secondCallback);
        });
    });

    describe("query key handling", () => {
        test("should handle single-level query keys", async ({
            queryWrapper,
        }: TestContext) => {
            vi.mocked(waitForTransactionReceipt).mockResolvedValue({
                status: "success",
            } as any);

            const invalidateSpy = vi.spyOn(
                queryWrapper.client,
                "invalidateQueries"
            );

            const { result } = renderHook(
                () => useWaitForTxAndInvalidateQueries(),
                { wrapper: queryWrapper.wrapper }
            );

            await result.current({
                hash: mockTxHash,
                queryKey: ["products"],
            });

            expect(invalidateSpy).toHaveBeenCalledWith({
                queryKey: ["products"],
                exact: false,
            });
        });

        test("should handle nested query keys", async ({
            queryWrapper,
        }: TestContext) => {
            vi.mocked(waitForTransactionReceipt).mockResolvedValue({
                status: "success",
            } as any);

            const invalidateSpy = vi.spyOn(
                queryWrapper.client,
                "invalidateQueries"
            );

            const { result } = renderHook(
                () => useWaitForTxAndInvalidateQueries(),
                { wrapper: queryWrapper.wrapper }
            );

            await result.current({
                hash: mockTxHash,
                queryKey: ["product", "0x123", "details"],
            });

            expect(invalidateSpy).toHaveBeenCalledWith({
                queryKey: ["product", "0x123", "details"],
                exact: false,
            });
        });
    });

    describe("multiple confirmations", () => {
        test("should handle 1 confirmation for fast operations", async ({
            queryWrapper,
        }: TestContext) => {
            vi.mocked(waitForTransactionReceipt).mockResolvedValue({
                status: "success",
            } as any);

            const { result } = renderHook(
                () => useWaitForTxAndInvalidateQueries(),
                { wrapper: queryWrapper.wrapper }
            );

            await result.current({
                hash: mockTxHash,
                queryKey: ["test"],
                confirmations: 1,
            });

            expect(waitForTransactionReceipt).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    confirmations: 1,
                    retryCount: 1,
                })
            );
        });

        test("should handle high confirmation count for important operations", async ({
            queryWrapper,
        }: TestContext) => {
            vi.mocked(waitForTransactionReceipt).mockResolvedValue({
                status: "success",
            } as any);

            const { result } = renderHook(
                () => useWaitForTxAndInvalidateQueries(),
                { wrapper: queryWrapper.wrapper }
            );

            await result.current({
                hash: mockTxHash,
                queryKey: ["test"],
                confirmations: 32,
            });

            expect(waitForTransactionReceipt).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    confirmations: 32,
                    retryCount: 32,
                })
            );
        });
    });

    describe("real-world scenarios", () => {
        test("should handle campaign creation flow", async ({
            queryWrapper,
        }: TestContext) => {
            vi.mocked(waitForTransactionReceipt).mockResolvedValue({
                status: "success",
            } as any);

            const { result } = renderHook(
                () => useWaitForTxAndInvalidateQueries(),
                { wrapper: queryWrapper.wrapper }
            );

            await result.current({
                hash: mockTxHash,
                queryKey: ["campaign", "new"],
                confirmations: 4,
            });

            expect(waitForTransactionReceipt).toHaveBeenCalled();
        });

        test("should handle product update flow", async ({
            queryWrapper,
        }: TestContext) => {
            vi.mocked(waitForTransactionReceipt).mockResolvedValue({
                status: "success",
            } as any);

            const { result } = renderHook(
                () => useWaitForTxAndInvalidateQueries(),
                { wrapper: queryWrapper.wrapper }
            );

            await result.current({
                hash: mockTxHash,
                queryKey: ["product", "0x123"],
                confirmations: 8,
            });

            expect(waitForTransactionReceipt).toHaveBeenCalled();
        });

        test("should handle bank funding flow", async ({
            queryWrapper,
        }: TestContext) => {
            vi.mocked(waitForTransactionReceipt).mockResolvedValue({
                status: "success",
            } as any);

            const invalidateSpy = vi.spyOn(
                queryWrapper.client,
                "invalidateQueries"
            );

            const { result } = renderHook(
                () => useWaitForTxAndInvalidateQueries(),
                { wrapper: queryWrapper.wrapper }
            );

            await result.current({
                hash: mockTxHash,
                queryKey: ["bank", "0xabc", "balance"],
                confirmations: 2,
            });

            expect(invalidateSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    queryKey: ["bank", "0xabc", "balance"],
                })
            );
        });
    });
});
