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

vi.mock("viem/actions", () => ({
    waitForTransactionReceipt: vi.fn(),
}));

vi.mock("@/config/blockchain", () => ({
    viemClient: {},
}));

vi.mock("radash", () => ({
    guard: vi.fn((fn) => fn()),
}));

describe("useWaitForTxAndInvalidateQueries", () => {
    const mockTxHash =
        "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd" as Hex;

    test("should wait with the default 16 confirmations", async ({
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

    test("should accept a custom confirmation count", async ({
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

    test("should invalidate the query key non-exactly after confirmation", async ({
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

    test("should still invalidate queries when the wait fails", async ({
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

        expect(invalidateSpy).toHaveBeenCalledWith({
            queryKey: ["product"],
            exact: false,
        });
    });
});
