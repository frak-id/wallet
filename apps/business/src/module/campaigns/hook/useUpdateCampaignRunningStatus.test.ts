import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, vi } from "vitest";
import {
    pauseCampaign,
    resumeCampaign,
} from "@/module/campaigns/api/campaignApi";
import {
    describe,
    expect,
    type TestContext,
    test,
} from "@/tests/vitest-fixtures";
import type { Campaign } from "@/types/Campaign";
import { useUpdateCampaignRunningStatus } from "./useUpdateCampaignRunningStatus";

vi.mock("@/module/campaigns/api/campaignApi", () => ({
    pauseCampaign: vi.fn(),
    resumeCampaign: vi.fn(),
}));

const mockCampaignResponse: Campaign = {
    id: "campaign-123",
    merchantId: "merchant-456",
    name: "Test Campaign",
    status: "active",
    priority: 0,
    rule: {
        trigger: "purchase",
        conditions: [],
        rewards: [],
    },
    metadata: null,
    budgetConfig: null,
    budgetUsed: null,
    expiresAt: null,
    publishedAt: "2024-01-01T00:00:00Z",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
};

describe("useUpdateCampaignRunningStatus", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("pause campaign", () => {
        test("should pause campaign when shouldRun is false", async ({
            queryWrapper,
        }: TestContext) => {
            vi.mocked(pauseCampaign).mockResolvedValue({
                ...mockCampaignResponse,
                status: "paused",
            });

            const { result } = renderHook(
                () => useUpdateCampaignRunningStatus(),
                { wrapper: queryWrapper.wrapper }
            );

            await result.current.mutateAsync({
                merchantId: "merchant-456",
                campaignId: "campaign-123",
                shouldRun: false,
            });

            expect(pauseCampaign).toHaveBeenCalledWith({
                merchantId: "merchant-456",
                campaignId: "campaign-123",
            });
            expect(resumeCampaign).not.toHaveBeenCalled();
        });
    });

    describe("resume campaign", () => {
        test("should resume campaign when shouldRun is true", async ({
            queryWrapper,
        }: TestContext) => {
            vi.mocked(resumeCampaign).mockResolvedValue(mockCampaignResponse);

            const { result } = renderHook(
                () => useUpdateCampaignRunningStatus(),
                { wrapper: queryWrapper.wrapper }
            );

            await result.current.mutateAsync({
                merchantId: "merchant-456",
                campaignId: "campaign-123",
                shouldRun: true,
            });

            expect(resumeCampaign).toHaveBeenCalledWith({
                merchantId: "merchant-456",
                campaignId: "campaign-123",
            });
            expect(pauseCampaign).not.toHaveBeenCalled();
        });
    });

    describe("error handling", () => {
        test("should handle pause errors", async ({
            queryWrapper,
        }: TestContext) => {
            vi.mocked(pauseCampaign).mockRejectedValue(
                new Error("Failed to pause campaign")
            );

            const { result } = renderHook(
                () => useUpdateCampaignRunningStatus(),
                { wrapper: queryWrapper.wrapper }
            );

            await expect(
                result.current.mutateAsync({
                    merchantId: "merchant-456",
                    campaignId: "campaign-123",
                    shouldRun: false,
                })
            ).rejects.toThrow("Failed to pause campaign");
        });

        test("should handle resume errors", async ({
            queryWrapper,
        }: TestContext) => {
            vi.mocked(resumeCampaign).mockRejectedValue(
                new Error("Failed to resume campaign")
            );

            const { result } = renderHook(
                () => useUpdateCampaignRunningStatus(),
                { wrapper: queryWrapper.wrapper }
            );

            await expect(
                result.current.mutateAsync({
                    merchantId: "merchant-456",
                    campaignId: "campaign-123",
                    shouldRun: true,
                })
            ).rejects.toThrow("Failed to resume campaign");
        });
    });

    describe("mutation state", () => {
        test("should track mutation loading state", async ({
            queryWrapper,
        }: TestContext) => {
            vi.mocked(pauseCampaign).mockImplementation(
                () =>
                    new Promise((resolve) =>
                        setTimeout(
                            () =>
                                resolve({
                                    ...mockCampaignResponse,
                                    status: "paused" as const,
                                }),
                            100
                        )
                    )
            );

            const { result } = renderHook(
                () => useUpdateCampaignRunningStatus(),
                { wrapper: queryWrapper.wrapper }
            );

            expect(result.current.isPending).toBe(false);

            const mutationPromise = result.current.mutateAsync({
                merchantId: "merchant-456",
                campaignId: "campaign-123",
                shouldRun: false,
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
            vi.mocked(pauseCampaign).mockResolvedValue({
                ...mockCampaignResponse,
                status: "paused",
            });
            vi.mocked(resumeCampaign).mockResolvedValue(mockCampaignResponse);

            const { result } = renderHook(
                () => useUpdateCampaignRunningStatus(),
                { wrapper: queryWrapper.wrapper }
            );

            await result.current.mutateAsync({
                merchantId: "merchant-456",
                campaignId: "campaign-1",
                shouldRun: false,
            });

            await result.current.mutateAsync({
                merchantId: "merchant-456",
                campaignId: "campaign-2",
                shouldRun: true,
            });

            expect(pauseCampaign).toHaveBeenCalledTimes(1);
            expect(resumeCampaign).toHaveBeenCalledTimes(1);
        });
    });
});
