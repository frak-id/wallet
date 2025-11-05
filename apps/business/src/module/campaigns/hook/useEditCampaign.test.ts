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
import { useEditCampaign } from "./useEditCampaign";

// Mock viem actions
vi.mock("viem/actions", () => ({
    readContract: vi.fn(),
}));

// Mock Frak SDK
vi.mock("@frak-labs/react-sdk", () => ({
    useSendTransactionAction: vi.fn(),
}));

// Mock bank info action
vi.mock("@/context/campaigns/action/getBankInfo", () => ({
    getBankTokenInfoInternal: vi.fn(),
}));

// Mock wait for tx utility
vi.mock("@/module/common/utils/useWaitForTxAndInvalidateQueries", () => ({
    useWaitForTxAndInvalidateQueries: vi.fn(),
}));

describe("useEditCampaign", () => {
    const mockCampaignAddress = createMockAddress("campaign");
    const mockBankAddress = createMockAddress("bank");

    describe("cap config update", () => {
        test("should update cap config successfully", async ({
            queryWrapper,
        }: TestContext) => {
            const { readContract } = await import("viem/actions");
            const { useSendTransactionAction } = await import(
                "@frak-labs/react-sdk"
            );
            const { getBankTokenInfoInternal } = await import(
                "@/context/campaigns/action/getBankInfo"
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

            // Mock readContract to return bank address
            vi.mocked(readContract).mockResolvedValue([
                null,
                null,
                mockBankAddress,
            ] as any);

            // Mock bank token info
            vi.mocked(getBankTokenInfoInternal).mockResolvedValue({
                decimals: 18,
                token: mockBankAddress,
            });

            const { result } = renderHook(() => useEditCampaign(), {
                wrapper: queryWrapper.wrapper,
            });

            await result.current.mutateAsync({
                campaign: mockCampaignAddress,
                capConfig: {
                    period: 86400,
                    amount: 100,
                },
            });

            expect(mockSendTx).toHaveBeenCalled();
            expect(mockWaitForTx).toHaveBeenCalledWith({
                hash: mockHash,
                queryKey: ["campaigns"],
            });
        });

        test("should handle different token decimals", async ({
            queryWrapper,
        }: TestContext) => {
            const { readContract } = await import("viem/actions");
            const { useSendTransactionAction } = await import(
                "@frak-labs/react-sdk"
            );
            const { getBankTokenInfoInternal } = await import(
                "@/context/campaigns/action/getBankInfo"
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
            vi.mocked(readContract).mockResolvedValue([
                null,
                null,
                mockBankAddress,
            ] as any);

            // Test with 6 decimals (like USDC)
            vi.mocked(getBankTokenInfoInternal).mockResolvedValue({
                decimals: 6,
                token: mockBankAddress,
            });

            const { result } = renderHook(() => useEditCampaign(), {
                wrapper: queryWrapper.wrapper,
            });

            await result.current.mutateAsync({
                campaign: mockCampaignAddress,
                capConfig: {
                    period: 604800,
                    amount: 1000,
                },
            });

            expect(getBankTokenInfoInternal).toHaveBeenCalledWith({
                bank: mockBankAddress,
            });
            expect(mockSendTx).toHaveBeenCalled();
        });
    });

    describe("activation period update", () => {
        test("should update activation period with start and end dates", async ({
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

            const { result } = renderHook(() => useEditCampaign(), {
                wrapper: queryWrapper.wrapper,
            });

            const startDate = new Date("2024-01-01T00:00:00Z");
            const endDate = new Date("2024-12-31T23:59:59Z");

            await result.current.mutateAsync({
                campaign: mockCampaignAddress,
                activationPeriod: {
                    start: startDate,
                    end: endDate,
                },
            });

            expect(mockSendTx).toHaveBeenCalled();
            const callData = mockSendTx.mock.calls[0][0];
            expect(callData.tx).toBeDefined();
            expect(callData.metadata.header.title).toBe("Edit campaign");
        });

        test("should update activation period with only start date", async ({
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

            const { result } = renderHook(() => useEditCampaign(), {
                wrapper: queryWrapper.wrapper,
            });

            const startDate = new Date("2024-01-01T00:00:00Z");

            await result.current.mutateAsync({
                campaign: mockCampaignAddress,
                activationPeriod: {
                    start: startDate,
                },
            });

            expect(mockSendTx).toHaveBeenCalled();
        });
    });

    describe("combined updates", () => {
        test("should update both cap config and activation period", async ({
            queryWrapper,
        }: TestContext) => {
            const { readContract } = await import("viem/actions");
            const { useSendTransactionAction } = await import(
                "@frak-labs/react-sdk"
            );
            const { getBankTokenInfoInternal } = await import(
                "@/context/campaigns/action/getBankInfo"
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
            vi.mocked(readContract).mockResolvedValue([
                null,
                null,
                mockBankAddress,
            ] as any);
            vi.mocked(getBankTokenInfoInternal).mockResolvedValue({
                decimals: 18,
                token: mockBankAddress,
            });

            const { result } = renderHook(() => useEditCampaign(), {
                wrapper: queryWrapper.wrapper,
            });

            const startDate = new Date("2024-01-01T00:00:00Z");

            await result.current.mutateAsync({
                campaign: mockCampaignAddress,
                capConfig: {
                    period: 86400,
                    amount: 100,
                },
                activationPeriod: {
                    start: startDate,
                },
            });

            expect(mockSendTx).toHaveBeenCalled();
            // Should have 2 call datas (cap config + activation period)
            const callData = mockSendTx.mock.calls[0][0];
            expect(callData.tx).toHaveLength(2);
        });
    });

    describe("edge cases", () => {
        test("should do nothing when no updates provided", async ({
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

            const { result } = renderHook(() => useEditCampaign(), {
                wrapper: queryWrapper.wrapper,
            });

            await result.current.mutateAsync({
                campaign: mockCampaignAddress,
            });

            expect(mockSendTx).not.toHaveBeenCalled();
            expect(mockWaitForTx).not.toHaveBeenCalled();
        });

        test("should not update activation period when start date is missing", async ({
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

            const { result } = renderHook(() => useEditCampaign(), {
                wrapper: queryWrapper.wrapper,
            });

            await result.current.mutateAsync({
                campaign: mockCampaignAddress,
                activationPeriod: {
                    end: new Date("2024-12-31T23:59:59Z"),
                },
            });

            // Should not send transaction since start is required
            expect(mockSendTx).not.toHaveBeenCalled();
        });
    });

    describe("error handling", () => {
        test("should handle transaction errors", async ({
            queryWrapper,
        }: TestContext) => {
            const { readContract } = await import("viem/actions");
            const { useSendTransactionAction } = await import(
                "@frak-labs/react-sdk"
            );
            const { getBankTokenInfoInternal } = await import(
                "@/context/campaigns/action/getBankInfo"
            );
            const { useWaitForTxAndInvalidateQueries } = await import(
                "@/module/common/utils/useWaitForTxAndInvalidateQueries"
            );

            const mockSendTx = vi
                .fn()
                .mockRejectedValue(new Error("Transaction failed"));

            vi.mocked(useSendTransactionAction).mockReturnValue({
                mutateAsync: mockSendTx,
            } as any);
            vi.mocked(useWaitForTxAndInvalidateQueries).mockReturnValue(
                vi.fn()
            );
            vi.mocked(readContract).mockResolvedValue([
                null,
                null,
                mockBankAddress,
            ] as any);
            vi.mocked(getBankTokenInfoInternal).mockResolvedValue({
                decimals: 18,
                token: mockBankAddress,
            });

            const { result } = renderHook(() => useEditCampaign(), {
                wrapper: queryWrapper.wrapper,
            });

            await expect(
                result.current.mutateAsync({
                    campaign: mockCampaignAddress,
                    capConfig: {
                        period: 86400,
                        amount: 100,
                    },
                })
            ).rejects.toThrow("Transaction failed");
        });

        test("should handle contract read errors", async ({
            queryWrapper,
        }: TestContext) => {
            const { readContract } = await import("viem/actions");
            const { useSendTransactionAction } = await import(
                "@frak-labs/react-sdk"
            );
            const { useWaitForTxAndInvalidateQueries } = await import(
                "@/module/common/utils/useWaitForTxAndInvalidateQueries"
            );

            vi.mocked(useSendTransactionAction).mockReturnValue({
                mutateAsync: vi.fn(),
            } as any);
            vi.mocked(useWaitForTxAndInvalidateQueries).mockReturnValue(
                vi.fn()
            );
            vi.mocked(readContract).mockRejectedValue(
                new Error("Contract read failed")
            );

            const { result } = renderHook(() => useEditCampaign(), {
                wrapper: queryWrapper.wrapper,
            });

            await expect(
                result.current.mutateAsync({
                    campaign: mockCampaignAddress,
                    capConfig: {
                        period: 86400,
                        amount: 100,
                    },
                })
            ).rejects.toThrow("Contract read failed");
        });
    });
});
