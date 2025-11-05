import { renderHook, waitFor } from "@testing-library/react";
import type { Hex } from "viem";
import { vi } from "vitest";
import {
    createMockAddress,
    describe,
    expect,
    type TestContext,
    test,
} from "@/tests/vitest-fixtures";
import { useAddProductMember } from "./useAddProductMember";

// Mock Frak SDK
vi.mock("@frak-labs/react-sdk", () => ({
    useSendTransactionAction: vi.fn(),
}));

// Mock wait for tx utility
vi.mock("@/module/common/utils/useWaitForTxAndInvalidateQueries", () => ({
    useWaitForTxAndInvalidateQueries: vi.fn(),
}));

describe("useAddProductMember", () => {
    const mockProductId = createMockAddress("product") as Hex;
    const mockWallet = createMockAddress("member-wallet");

    describe("successful member addition", () => {
        test("should add member with single role", async ({
            queryWrapper,
        }: TestContext) => {
            const { useSendTransactionAction } = await import(
                "@frak-labs/react-sdk"
            );
            const { useWaitForTxAndInvalidateQueries } = await import(
                "@/module/common/utils/useWaitForTxAndInvalidateQueries"
            );

            const mockHash = "0xabcdef123456789" as Hex;
            const mockSendTx = vi.fn().mockResolvedValue({ hash: mockHash });
            const mockWaitForTx = vi.fn().mockResolvedValue(undefined);

            vi.mocked(useSendTransactionAction).mockReturnValue({
                mutateAsync: mockSendTx,
            } as any);
            vi.mocked(useWaitForTxAndInvalidateQueries).mockReturnValue(
                mockWaitForTx
            );

            const { result } = renderHook(() => useAddProductMember(), {
                wrapper: queryWrapper.wrapper,
            });

            await result.current.mutateAsync({
                productId: mockProductId,
                wallet: mockWallet,
                roles: ["campaignManager"],
            });

            expect(mockSendTx).toHaveBeenCalled();
            expect(mockWaitForTx).toHaveBeenCalledWith({
                hash: mockHash,
                queryKey: ["product"],
            });
        });

        test("should add member with multiple roles", async ({
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

            const { result } = renderHook(() => useAddProductMember(), {
                wrapper: queryWrapper.wrapper,
            });

            await result.current.mutateAsync({
                productId: mockProductId,
                wallet: mockWallet,
                roles: ["productAdministrator", "campaignManager"],
            });

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });
        });

        test("should include i18n translations", async ({
            queryWrapper,
        }: TestContext) => {
            const { useSendTransactionAction } = await import(
                "@frak-labs/react-sdk"
            );
            const { useWaitForTxAndInvalidateQueries } = await import(
                "@/module/common/utils/useWaitForTxAndInvalidateQueries"
            );

            const mockSendTx = vi.fn().mockResolvedValue({ hash: "0xabc" });

            vi.mocked(useSendTransactionAction).mockReturnValue({
                mutateAsync: mockSendTx,
            } as any);
            vi.mocked(useWaitForTxAndInvalidateQueries).mockReturnValue(
                vi.fn()
            );

            const { result } = renderHook(() => useAddProductMember(), {
                wrapper: queryWrapper.wrapper,
            });

            await result.current.mutateAsync({
                productId: mockProductId,
                wallet: mockWallet,
                roles: ["campaignManager"],
            });

            const metadata = mockSendTx.mock.calls[0][0].metadata;
            expect(metadata.header.title).toBe("Add member");
            expect(metadata.i18n.fr).toBeDefined();
            expect(metadata.i18n.en).toBeDefined();
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

            const { result } = renderHook(() => useAddProductMember(), {
                wrapper: queryWrapper.wrapper,
            });

            await expect(
                result.current.mutateAsync({
                    productId: mockProductId,
                    wallet: mockWallet,
                    roles: ["campaignManager"],
                })
            ).rejects.toThrow("Transaction failed");
        });
    });
});
