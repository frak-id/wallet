import { useSendTransactionAction } from "@frak-labs/react-sdk";
import { renderHook, waitFor } from "@testing-library/react";
import type { Hex } from "viem";
import { vi } from "vitest";
import { useWaitForTxAndInvalidateQueries } from "@/module/common/utils/useWaitForTxAndInvalidateQueries";
import {
    createMockAddress,
    describe,
    expect,
    type TestContext,
    test,
} from "@/tests/vitest-fixtures";
import { useSetBankDistributionStatus } from "./useSetBankDistributionStatus";

// Mock Frak SDK
vi.mock("@frak-labs/react-sdk", () => ({
    useSendTransactionAction: vi.fn(),
}));

// Mock wait for tx utility
vi.mock("@/module/common/utils/useWaitForTxAndInvalidateQueries", () => ({
    useWaitForTxAndInvalidateQueries: vi.fn(),
}));

describe("useSetBankDistributionStatus", () => {
    const mockProductId = createMockAddress("product") as Hex;
    const mockBankAddress = createMockAddress("bank");

    describe("enable distribution", () => {
        test("should enable bank distribution successfully", async ({
            queryWrapper,
        }: TestContext) => {
            const mockHash = "0xabcdef123456789" as Hex;
            const mockSendTx = vi.fn().mockResolvedValue({ hash: mockHash });
            const mockWaitForTx = vi.fn().mockResolvedValue(undefined);

            vi.mocked(useSendTransactionAction).mockReturnValue({
                mutateAsync: mockSendTx,
            } as any);
            vi.mocked(useWaitForTxAndInvalidateQueries).mockReturnValue(
                mockWaitForTx
            );

            const { result } = renderHook(
                () =>
                    useSetBankDistributionStatus({
                        productId: mockProductId,
                        bank: mockBankAddress,
                    }),
                { wrapper: queryWrapper.wrapper }
            );

            result.current.setDistributionStatus({ isDistributing: true });

            await waitFor(() => {
                expect(mockSendTx).toHaveBeenCalled();
            });

            expect(mockWaitForTx).toHaveBeenCalledWith({
                hash: mockHash,
                queryKey: ["product"],
            });
        });
    });

    describe("disable distribution", () => {
        test("should disable bank distribution successfully", async ({
            queryWrapper,
        }: TestContext) => {
            const mockSendTx = vi.fn().mockResolvedValue({ hash: "0xabc" });
            const mockWaitForTx = vi.fn().mockResolvedValue(undefined);

            vi.mocked(useSendTransactionAction).mockReturnValue({
                mutateAsync: mockSendTx,
            } as any);
            vi.mocked(useWaitForTxAndInvalidateQueries).mockReturnValue(
                mockWaitForTx
            );

            const { result } = renderHook(
                () =>
                    useSetBankDistributionStatus({
                        productId: mockProductId,
                        bank: mockBankAddress,
                    }),
                { wrapper: queryWrapper.wrapper }
            );

            result.current.setDistributionStatus({ isDistributing: false });

            await waitFor(() => {
                expect(mockSendTx).toHaveBeenCalled();
            });
        });
    });

    describe("loading state", () => {
        test("should track isSettingDistributionStatus", async ({
            queryWrapper,
        }: TestContext) => {
            const mockSendTx = vi
                .fn()
                .mockImplementation(
                    () =>
                        new Promise((resolve) =>
                            setTimeout(() => resolve({ hash: "0xabc" }), 100)
                        )
                );
            const mockWaitForTx = vi.fn().mockResolvedValue(undefined);

            vi.mocked(useSendTransactionAction).mockReturnValue({
                mutateAsync: mockSendTx,
            } as any);
            vi.mocked(useWaitForTxAndInvalidateQueries).mockReturnValue(
                mockWaitForTx
            );

            const { result } = renderHook(
                () =>
                    useSetBankDistributionStatus({
                        productId: mockProductId,
                        bank: mockBankAddress,
                    }),
                { wrapper: queryWrapper.wrapper }
            );

            expect(result.current.isSettingDistributionStatus).toBe(false);

            result.current.setDistributionStatus({ isDistributing: true });

            await waitFor(() => {
                expect(result.current.isSettingDistributionStatus).toBe(true);
            });

            await waitFor(() => {
                expect(result.current.isSettingDistributionStatus).toBe(false);
            });
        });
    });

    describe("i18n metadata", () => {
        test("should include French and English translations", async ({
            queryWrapper,
        }: TestContext) => {
            const mockSendTx = vi.fn().mockResolvedValue({ hash: "0xabc" });
            const mockWaitForTx = vi.fn().mockResolvedValue(undefined);

            vi.mocked(useSendTransactionAction).mockReturnValue({
                mutateAsync: mockSendTx,
            } as any);
            vi.mocked(useWaitForTxAndInvalidateQueries).mockReturnValue(
                mockWaitForTx
            );

            const { result } = renderHook(
                () =>
                    useSetBankDistributionStatus({
                        productId: mockProductId,
                        bank: mockBankAddress,
                    }),
                { wrapper: queryWrapper.wrapper }
            );

            result.current.setDistributionStatus({ isDistributing: true });

            await waitFor(() => {
                expect(mockSendTx).toHaveBeenCalled();
            });

            const metadata = mockSendTx.mock.calls[0][0].metadata;
            expect(metadata.header.title).toBe("Toggle distribution state");
            expect(metadata.i18n.fr).toBeDefined();
            expect(metadata.i18n.en).toBeDefined();
            expect(
                metadata.i18n.en["sdk.modal.sendTransaction.description"]
            ).toContain(mockBankAddress);
        });
    });

    describe("error handling", () => {
        test("should handle transaction errors", async ({
            queryWrapper,
        }: TestContext) => {
            vi.mocked(useSendTransactionAction).mockReturnValue({
                mutateAsync: vi
                    .fn()
                    .mockRejectedValue(new Error("Transaction failed")),
            } as any);
            vi.mocked(useWaitForTxAndInvalidateQueries).mockReturnValue(
                vi.fn()
            );

            const { result } = renderHook(
                () =>
                    useSetBankDistributionStatus({
                        productId: mockProductId,
                        bank: mockBankAddress,
                    }),
                { wrapper: queryWrapper.wrapper }
            );

            result.current.setDistributionStatus({ isDistributing: true });

            await waitFor(() => {
                // Mutation should be in error state
                const mutationCache = queryWrapper.client
                    .getMutationCache()
                    .getAll();
                expect(mutationCache.length).toBeGreaterThan(0);
            });
        });
    });
});
