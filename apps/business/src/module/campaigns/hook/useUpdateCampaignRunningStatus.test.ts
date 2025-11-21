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
import { useUpdateCampaignRunningStatus } from "./useUpdateCampaignRunningStatus";

// Mock Frak SDK
vi.mock("@frak-labs/react-sdk", () => ({
    useSendTransactionAction: vi.fn(),
}));

// Mock wait for tx utility
vi.mock("@/module/common/utils/useWaitForTxAndInvalidateQueries", () => ({
    useWaitForTxAndInvalidateQueries: vi.fn(),
}));

describe("useUpdateCampaignRunningStatus", () => {
    const mockCampaignAddress = createMockAddress("campaign");

    describe("pause campaign (set to not running)", () => {
        test("should pause campaign successfully", async ({
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
                () => useUpdateCampaignRunningStatus(),
                { wrapper: queryWrapper.wrapper }
            );

            await result.current.mutateAsync({
                campaign: mockCampaignAddress,
                newRunningStatus: false,
            });

            expect(mockSendTx).toHaveBeenCalledWith({
                tx: expect.objectContaining({
                    to: mockCampaignAddress,
                    data: expect.any(String),
                }),
                metadata: expect.objectContaining({
                    header: { title: "Update campaign" },
                }),
            });

            expect(mockWaitForTx).toHaveBeenCalledWith({
                hash: mockHash,
                queryKey: ["campaigns"],
            });
        });
    });

    describe("resume campaign (set to running)", () => {
        test("should resume campaign successfully", async ({
            queryWrapper,
        }: TestContext) => {
            const mockHash = "0x123abc" as Hex;
            const mockSendTx = vi.fn().mockResolvedValue({ hash: mockHash });
            const mockWaitForTx = vi.fn().mockResolvedValue(undefined);

            vi.mocked(useSendTransactionAction).mockReturnValue({
                mutateAsync: mockSendTx,
            } as any);
            vi.mocked(useWaitForTxAndInvalidateQueries).mockReturnValue(
                mockWaitForTx
            );

            const { result } = renderHook(
                () => useUpdateCampaignRunningStatus(),
                { wrapper: queryWrapper.wrapper }
            );

            await result.current.mutateAsync({
                campaign: mockCampaignAddress,
                newRunningStatus: true,
            });

            expect(mockSendTx).toHaveBeenCalled();
            expect(mockWaitForTx).toHaveBeenCalledWith({
                hash: mockHash,
                queryKey: ["campaigns"],
            });
        });
    });

    describe("i18n metadata", () => {
        test("should include French translation", async ({
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
                () => useUpdateCampaignRunningStatus(),
                { wrapper: queryWrapper.wrapper }
            );

            await result.current.mutateAsync({
                campaign: mockCampaignAddress,
                newRunningStatus: false,
            });

            const metadata = mockSendTx.mock.calls[0][0].metadata;
            expect(metadata.i18n.fr).toEqual({
                "sdk.modal.sendTransaction.description":
                    "Mettre à jour le statut d'exécution de la campagne",
            });
        });

        test("should include English translation", async ({
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
                () => useUpdateCampaignRunningStatus(),
                { wrapper: queryWrapper.wrapper }
            );

            await result.current.mutateAsync({
                campaign: mockCampaignAddress,
                newRunningStatus: true,
            });

            const metadata = mockSendTx.mock.calls[0][0].metadata;
            expect(metadata.i18n.en).toEqual({
                "sdk.modal.sendTransaction.description":
                    "Update the running status of the campaign",
            });
        });
    });

    describe("error handling", () => {
        test("should handle transaction errors", async ({
            queryWrapper,
        }: TestContext) => {
            const mockSendTx = vi
                .fn()
                .mockRejectedValue(new Error("Transaction failed"));

            vi.mocked(useSendTransactionAction).mockReturnValue({
                mutateAsync: mockSendTx,
            } as any);
            vi.mocked(useWaitForTxAndInvalidateQueries).mockReturnValue(
                vi.fn()
            );

            const { result } = renderHook(
                () => useUpdateCampaignRunningStatus(),
                { wrapper: queryWrapper.wrapper }
            );

            await expect(
                result.current.mutateAsync({
                    campaign: mockCampaignAddress,
                    newRunningStatus: false,
                })
            ).rejects.toThrow("Transaction failed");
        });

        test("should handle wait for tx errors", async ({
            queryWrapper,
        }: TestContext) => {
            const mockSendTx = vi.fn().mockResolvedValue({ hash: "0xabc" });
            const mockWaitForTx = vi
                .fn()
                .mockRejectedValue(new Error("Transaction wait failed"));

            vi.mocked(useSendTransactionAction).mockReturnValue({
                mutateAsync: mockSendTx,
            } as any);
            vi.mocked(useWaitForTxAndInvalidateQueries).mockReturnValue(
                mockWaitForTx
            );

            const { result } = renderHook(
                () => useUpdateCampaignRunningStatus(),
                { wrapper: queryWrapper.wrapper }
            );

            await expect(
                result.current.mutateAsync({
                    campaign: mockCampaignAddress,
                    newRunningStatus: true,
                })
            ).rejects.toThrow("Transaction wait failed");
        });
    });

    describe("mutation state", () => {
        test("should track mutation loading state", async ({
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
                () => useUpdateCampaignRunningStatus(),
                { wrapper: queryWrapper.wrapper }
            );

            expect(result.current.isPending).toBe(false);

            const mutationPromise = result.current.mutateAsync({
                campaign: mockCampaignAddress,
                newRunningStatus: false,
            });

            await waitFor(() => {
                expect(result.current.isPending).toBe(true);
            });

            await mutationPromise;

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });
        });
    });

    describe("multiple campaigns", () => {
        test("should handle updating different campaigns", async ({
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
                () => useUpdateCampaignRunningStatus(),
                { wrapper: queryWrapper.wrapper }
            );

            const campaign1 = createMockAddress("campaign1");
            const campaign2 = createMockAddress("campaign2");

            await result.current.mutateAsync({
                campaign: campaign1,
                newRunningStatus: false,
            });

            await result.current.mutateAsync({
                campaign: campaign2,
                newRunningStatus: true,
            });

            expect(mockSendTx).toHaveBeenCalledTimes(2);
        });
    });
});
