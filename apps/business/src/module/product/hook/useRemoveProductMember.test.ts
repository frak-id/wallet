import { renderHook } from "@testing-library/react";
import type { Hex } from "viem";
import { vi } from "vitest";
import {
    createMockAddress,
    describe,
    expect,
    type TestContext,
    test,
} from "@/tests/vitest-fixtures";
import { useRemoveProductMember } from "./useRemoveProductMember";

// Mock Frak SDK
vi.mock("@frak-labs/react-sdk", () => ({
    useSendTransactionAction: vi.fn(),
}));

// Mock wait for tx utility
vi.mock("@/module/common/utils/useWaitForTxAndInvalidateQueries", () => ({
    useWaitForTxAndInvalidateQueries: vi.fn(),
}));

describe("useRemoveProductMember", () => {
    const mockProductId = createMockAddress("product") as Hex;
    const mockWallet = createMockAddress("member-wallet");

    describe("full removal", () => {
        test("should renounce all roles", async ({
            queryWrapper,
        }: TestContext) => {
            const { useSendTransactionAction } = await import(
                "@frak-labs/react-sdk"
            );
            const { useWaitForTxAndInvalidateQueries } = await import(
                "@/module/common/utils/useWaitForTxAndInvalidateQueries"
            );

            const mockHash = "0xabcdef" as Hex;
            const mockSendTx = vi.fn().mockResolvedValue({ hash: mockHash });
            const mockWaitForTx = vi.fn().mockResolvedValue(undefined);

            vi.mocked(useSendTransactionAction).mockReturnValue({
                mutateAsync: mockSendTx,
            } as any);
            vi.mocked(useWaitForTxAndInvalidateQueries).mockReturnValue(
                mockWaitForTx
            );

            const { result } = renderHook(() => useRemoveProductMember(), {
                wrapper: queryWrapper.wrapper,
            });

            await result.current.mutateAsync({
                productId: mockProductId,
                fullRemoval: true,
                isRenouncing: true,
            });

            expect(mockSendTx).toHaveBeenCalled();
            expect(mockWaitForTx).toHaveBeenCalledWith({
                hash: mockHash,
                queryKey: ["product"],
            });
        });

        test("should revoke all roles from wallet", async ({
            queryWrapper,
        }: TestContext) => {
            const { useSendTransactionAction } = await import(
                "@frak-labs/react-sdk"
            );
            const { useWaitForTxAndInvalidateQueries } = await import(
                "@/module/common/utils/useWaitForTxAndInvalidateQueries"
            );

            const mockSendTx = vi.fn().mockResolvedValue({ hash: "0xabc" });
            const mockWaitForTx = vi.fn().mockResolvedValue(undefined);

            vi.mocked(useSendTransactionAction).mockReturnValue({
                mutateAsync: mockSendTx,
            } as any);
            vi.mocked(useWaitForTxAndInvalidateQueries).mockReturnValue(
                mockWaitForTx
            );

            const { result } = renderHook(() => useRemoveProductMember(), {
                wrapper: queryWrapper.wrapper,
            });

            await result.current.mutateAsync({
                productId: mockProductId,
                fullRemoval: true,
                isRenouncing: false,
                wallet: mockWallet,
            });

            expect(mockSendTx).toHaveBeenCalled();
        });
    });

    describe("partial removal", () => {
        test("should renounce specific roles", async ({
            queryWrapper,
        }: TestContext) => {
            const { useSendTransactionAction } = await import(
                "@frak-labs/react-sdk"
            );
            const { useWaitForTxAndInvalidateQueries } = await import(
                "@/module/common/utils/useWaitForTxAndInvalidateQueries"
            );

            const mockSendTx = vi.fn().mockResolvedValue({ hash: "0xabc" });
            const mockWaitForTx = vi.fn().mockResolvedValue(undefined);

            vi.mocked(useSendTransactionAction).mockReturnValue({
                mutateAsync: mockSendTx,
            } as any);
            vi.mocked(useWaitForTxAndInvalidateQueries).mockReturnValue(
                mockWaitForTx
            );

            const { result } = renderHook(() => useRemoveProductMember(), {
                wrapper: queryWrapper.wrapper,
            });

            await result.current.mutateAsync({
                productId: mockProductId,
                fullRemoval: false,
                rolesToDelete: ["campaignManager"],
                isRenouncing: true,
            });

            expect(mockSendTx).toHaveBeenCalled();
        });

        test("should revoke specific roles from wallet", async ({
            queryWrapper,
        }: TestContext) => {
            const { useSendTransactionAction } = await import(
                "@frak-labs/react-sdk"
            );
            const { useWaitForTxAndInvalidateQueries } = await import(
                "@/module/common/utils/useWaitForTxAndInvalidateQueries"
            );

            const mockSendTx = vi.fn().mockResolvedValue({ hash: "0xabc" });
            const mockWaitForTx = vi.fn().mockResolvedValue(undefined);

            vi.mocked(useSendTransactionAction).mockReturnValue({
                mutateAsync: mockSendTx,
            } as any);
            vi.mocked(useWaitForTxAndInvalidateQueries).mockReturnValue(
                mockWaitForTx
            );

            const { result } = renderHook(() => useRemoveProductMember(), {
                wrapper: queryWrapper.wrapper,
            });

            await result.current.mutateAsync({
                productId: mockProductId,
                fullRemoval: false,
                rolesToDelete: ["productAdministrator", "campaignManager"],
                isRenouncing: false,
                wallet: mockWallet,
            });

            expect(mockSendTx).toHaveBeenCalled();
        });
    });

    describe("error handling", () => {
        test("should handle transaction errors", async ({
            queryWrapper,
        }: TestContext) => {
            const { useSendTransactionAction } = await import(
                "@frak-labs/react-sdk"
            );
            const { useWaitForTxAndInvalidateQueries } = await import(
                "@/module/common/utils/useWaitForTxAndInvalidateQueries"
            );

            vi.mocked(useSendTransactionAction).mockReturnValue({
                mutateAsync: vi
                    .fn()
                    .mockRejectedValue(new Error("Transaction failed")),
            } as any);
            vi.mocked(useWaitForTxAndInvalidateQueries).mockReturnValue(
                vi.fn()
            );

            const { result } = renderHook(() => useRemoveProductMember(), {
                wrapper: queryWrapper.wrapper,
            });

            await expect(
                result.current.mutateAsync({
                    productId: mockProductId,
                    fullRemoval: true,
                    isRenouncing: true,
                })
            ).rejects.toThrow("Transaction failed");
        });
    });
});
