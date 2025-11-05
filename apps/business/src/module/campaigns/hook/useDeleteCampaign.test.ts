import { renderHook, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import {
    createMockAddress,
    describe,
    expect,
    type TestContext,
    test,
} from "@/tests/vitest-fixtures";
import { useDeleteCampaign } from "./useDeleteCampaign";

// Mock the deleteCampaign action
vi.mock("@/context/campaigns/action/deleteCampaign", () => ({
    deleteCampaign: vi.fn(),
}));

// Mock Frak SDK
vi.mock("@frak-labs/react-sdk", () => ({
    useSendTransactionAction: vi.fn(),
}));

describe("useDeleteCampaign", () => {
    describe("direct deletion (success response)", () => {
        test("should delete campaign successfully without on-chain transaction", async ({
            queryWrapper,
        }: TestContext) => {
            const { deleteCampaign } = await import(
                "@/context/campaigns/action/deleteCampaign"
            );
            const { useSendTransactionAction } = await import(
                "@frak-labs/react-sdk"
            );

            const mockSendTx = vi.fn();
            vi.mocked(useSendTransactionAction).mockReturnValue({
                mutateAsync: mockSendTx,
            } as any);

            vi.mocked(deleteCampaign).mockResolvedValue({
                key: "success",
            });

            const { result } = renderHook(() => useDeleteCampaign(), {
                wrapper: queryWrapper.wrapper,
            });

            const campaignId = "507f1f77bcf86cd799439011";

            await result.current.mutateAsync({ campaignId });

            expect(deleteCampaign).toHaveBeenCalledWith({
                data: { campaignId },
            });
            expect(mockSendTx).not.toHaveBeenCalled();
        });

        test("should invalidate campaigns query after successful deletion", async ({
            queryWrapper,
        }: TestContext) => {
            const { deleteCampaign } = await import(
                "@/context/campaigns/action/deleteCampaign"
            );
            const { useSendTransactionAction } = await import(
                "@frak-labs/react-sdk"
            );

            vi.mocked(useSendTransactionAction).mockReturnValue({
                mutateAsync: vi.fn(),
            } as any);

            vi.mocked(deleteCampaign).mockResolvedValue({
                key: "success",
            });

            const { result } = renderHook(() => useDeleteCampaign(), {
                wrapper: queryWrapper.wrapper,
            });

            await result.current.mutateAsync({
                campaignId: "507f1f77bcf86cd799439011",
            });

            // Wait for mutation to complete
            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(deleteCampaign).toHaveBeenCalledWith({
                data: { campaignId: "507f1f77bcf86cd799439011" },
            });
        });
    });

    describe("on-chain deletion flow", () => {
        test("should handle on-chain deletion flow", async ({
            queryWrapper,
        }: TestContext) => {
            const { deleteCampaign } = await import(
                "@/context/campaigns/action/deleteCampaign"
            );
            const { useSendTransactionAction } = await import(
                "@frak-labs/react-sdk"
            );

            const mockSendTx = vi.fn().mockResolvedValue({
                hash: "0xabcdef",
            });
            vi.mocked(useSendTransactionAction).mockReturnValue({
                mutateAsync: mockSendTx,
            } as any);

            const mockTx = [
                {
                    to: createMockAddress("campaign-contract") as `0x${string}`,
                    data: "0xdeadbeef" as `0x${string}`,
                },
            ];

            // First call returns require-onchain-delete
            // Second call (after tx) returns success
            vi.mocked(deleteCampaign)
                .mockResolvedValueOnce({
                    key: "require-onchain-delete",
                    tx: mockTx,
                })
                .mockResolvedValueOnce({
                    key: "success",
                });

            const { result } = renderHook(() => useDeleteCampaign(), {
                wrapper: queryWrapper.wrapper,
            });

            const campaignId = "507f1f77bcf86cd799439011";

            await result.current.mutateAsync({ campaignId });

            // Should call deleteCampaign at least twice (may be more due to query invalidation)
            expect(deleteCampaign).toHaveBeenCalledWith({
                data: { campaignId },
            });
            // Verify it was called with require-onchain-delete scenario
            expect(mockSendTx).toHaveBeenCalledTimes(1);

            // Should call sendTx with transaction
            expect(mockSendTx).toHaveBeenCalledWith({
                metadata: {
                    i18n: {
                        fr: {
                            "sdk.modal.sendTransaction.description": `Supprimer la campagne ${campaignId}`,
                        },
                        en: {
                            "sdk.modal.sendTransaction.description": `Delete campaign ${campaignId}`,
                        },
                    },
                },
                tx: mockTx,
            });
        });

        test("should include transaction hash in logs", async ({
            queryWrapper,
        }: TestContext) => {
            const { deleteCampaign } = await import(
                "@/context/campaigns/action/deleteCampaign"
            );
            const { useSendTransactionAction } = await import(
                "@frak-labs/react-sdk"
            );

            const consoleLogSpy = vi
                .spyOn(console, "log")
                .mockImplementation(() => {});

            const mockHash = "0xabcdef123456789";
            const mockSendTx = vi.fn().mockResolvedValue({
                hash: mockHash,
            });
            vi.mocked(useSendTransactionAction).mockReturnValue({
                mutateAsync: mockSendTx,
            } as any);

            vi.mocked(deleteCampaign)
                .mockResolvedValueOnce({
                    key: "require-onchain-delete",
                    tx: [],
                })
                .mockResolvedValueOnce({
                    key: "success",
                });

            const { result } = renderHook(() => useDeleteCampaign(), {
                wrapper: queryWrapper.wrapper,
            });

            await result.current.mutateAsync({
                campaignId: "507f1f77bcf86cd799439011",
            });

            expect(consoleLogSpy).toHaveBeenCalledWith(
                "Submitted campaign deletion transaction",
                { hash: mockHash }
            );

            consoleLogSpy.mockRestore();
        });
    });

    describe("error handling", () => {
        test("should throw error when deletion fails", async ({
            queryWrapper,
        }: TestContext) => {
            const { deleteCampaign } = await import(
                "@/context/campaigns/action/deleteCampaign"
            );
            const { useSendTransactionAction } = await import(
                "@frak-labs/react-sdk"
            );

            vi.mocked(useSendTransactionAction).mockReturnValue({
                mutateAsync: vi.fn(),
            } as any);

            vi.mocked(deleteCampaign).mockResolvedValue({
                key: "error",
            } as any);

            const { result } = renderHook(() => useDeleteCampaign(), {
                wrapper: queryWrapper.wrapper,
            });

            await expect(
                result.current.mutateAsync({
                    campaignId: "507f1f77bcf86cd799439011",
                })
            ).rejects.toThrow("Campaign deletion failed");
        });

        test("should throw error after on-chain transaction if final result is not success", async ({
            queryWrapper,
        }: TestContext) => {
            const { deleteCampaign } = await import(
                "@/context/campaigns/action/deleteCampaign"
            );
            const { useSendTransactionAction } = await import(
                "@frak-labs/react-sdk"
            );

            const mockSendTx = vi.fn().mockResolvedValue({
                hash: "0xabcdef",
            });
            vi.mocked(useSendTransactionAction).mockReturnValue({
                mutateAsync: mockSendTx,
            } as any);

            // First call requires on-chain delete
            // Second call (after tx) still fails
            vi.mocked(deleteCampaign)
                .mockResolvedValueOnce({
                    key: "require-onchain-delete",
                    tx: [],
                })
                .mockResolvedValueOnce({
                    key: "error",
                } as any);

            const { result } = renderHook(() => useDeleteCampaign(), {
                wrapper: queryWrapper.wrapper,
            });

            await expect(
                result.current.mutateAsync({
                    campaignId: "507f1f77bcf86cd799439011",
                })
            ).rejects.toThrow("Campaign deletion failed");
        });

        test("should handle transaction submission errors", async ({
            queryWrapper,
        }: TestContext) => {
            const { deleteCampaign } = await import(
                "@/context/campaigns/action/deleteCampaign"
            );
            const { useSendTransactionAction } = await import(
                "@frak-labs/react-sdk"
            );

            const mockSendTx = vi
                .fn()
                .mockRejectedValue(new Error("Transaction failed"));
            vi.mocked(useSendTransactionAction).mockReturnValue({
                mutateAsync: mockSendTx,
            } as any);

            vi.mocked(deleteCampaign).mockResolvedValue({
                key: "require-onchain-delete",
                tx: [],
            });

            const { result } = renderHook(() => useDeleteCampaign(), {
                wrapper: queryWrapper.wrapper,
            });

            await expect(
                result.current.mutateAsync({
                    campaignId: "507f1f77bcf86cd799439011",
                })
            ).rejects.toThrow("Transaction failed");
        });
    });

    describe("mutation state", () => {
        test("should track mutation loading state", async ({
            queryWrapper,
        }: TestContext) => {
            const { deleteCampaign } = await import(
                "@/context/campaigns/action/deleteCampaign"
            );
            const { useSendTransactionAction } = await import(
                "@frak-labs/react-sdk"
            );

            vi.mocked(useSendTransactionAction).mockReturnValue({
                mutateAsync: vi.fn(),
            } as any);

            vi.mocked(deleteCampaign).mockImplementation(
                () =>
                    new Promise((resolve) =>
                        setTimeout(
                            () =>
                                resolve({
                                    key: "success",
                                }),
                            100
                        )
                    )
            );

            const { result } = renderHook(() => useDeleteCampaign(), {
                wrapper: queryWrapper.wrapper,
            });

            expect(result.current.isPending).toBe(false);

            const mutationPromise = result.current.mutateAsync({
                campaignId: "507f1f77bcf86cd799439011",
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
});
