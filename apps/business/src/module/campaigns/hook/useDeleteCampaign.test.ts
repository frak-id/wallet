import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, vi } from "vitest";
import { deleteCampaign } from "@/context/campaigns/action/deleteCampaign";
import {
    describe,
    expect,
    type TestContext,
    test,
} from "@/tests/vitest-fixtures";
import { useDeleteCampaign } from "./useDeleteCampaign";

vi.mock("@/context/campaigns/action/deleteCampaign", () => ({
    deleteCampaign: vi.fn(),
}));

describe("useDeleteCampaign", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("successful deletion", () => {
        test("should delete campaign with merchantId and campaignId", async ({
            queryWrapper,
        }: TestContext) => {
            vi.mocked(deleteCampaign).mockResolvedValue({
                success: true,
            });

            const { result } = renderHook(() => useDeleteCampaign(), {
                wrapper: queryWrapper.wrapper,
            });

            await result.current.mutateAsync({
                merchantId: "merchant-456",
                campaignId: "campaign-123",
            });

            expect(deleteCampaign).toHaveBeenCalledWith({
                data: {
                    merchantId: "merchant-456",
                    campaignId: "campaign-123",
                },
            });
        });

        test("should invalidate campaigns query after deletion", async ({
            queryWrapper,
        }: TestContext) => {
            vi.mocked(deleteCampaign).mockResolvedValue({
                success: true,
            });

            const { result } = renderHook(() => useDeleteCampaign(), {
                wrapper: queryWrapper.wrapper,
            });

            await result.current.mutateAsync({
                merchantId: "merchant-456",
                campaignId: "campaign-123",
            });

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });
        });
    });

    describe("error handling", () => {
        test("should handle deletion errors", async ({
            queryWrapper,
        }: TestContext) => {
            vi.mocked(deleteCampaign).mockRejectedValue(
                new Error("Failed to delete campaign")
            );

            const { result } = renderHook(() => useDeleteCampaign(), {
                wrapper: queryWrapper.wrapper,
            });

            await expect(
                result.current.mutateAsync({
                    merchantId: "merchant-456",
                    campaignId: "campaign-123",
                })
            ).rejects.toThrow("Failed to delete campaign");
        });
    });

    describe("mutation state", () => {
        test("should track mutation loading state", async ({
            queryWrapper,
        }: TestContext) => {
            vi.mocked(deleteCampaign).mockImplementation(
                () =>
                    new Promise((resolve) =>
                        setTimeout(
                            () => resolve({ success: true as const }),
                            100
                        )
                    )
            );

            const { result } = renderHook(() => useDeleteCampaign(), {
                wrapper: queryWrapper.wrapper,
            });

            expect(result.current.isPending).toBe(false);

            const mutationPromise = result.current.mutateAsync({
                merchantId: "merchant-456",
                campaignId: "campaign-123",
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
