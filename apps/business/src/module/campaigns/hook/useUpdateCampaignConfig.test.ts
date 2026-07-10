import { renderHook } from "@testing-library/react";
import { beforeEach, vi } from "vitest";
import { updateCampaign } from "@/module/campaigns/api/campaignApi";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";
import { getStartDate } from "@/stores/campaignStore";
import {
    describe,
    expect,
    type TestContext,
    test,
} from "@/tests/vitest-fixtures";
import type { Campaign } from "@/types/Campaign";
import { useUpdateCampaignConfig } from "./useUpdateCampaignConfig";

vi.mock("@/module/campaigns/api/campaignApi", () => ({
    updateCampaign: vi.fn(),
}));

vi.mock("@/module/common/atoms/demoMode", () => ({
    useIsDemoMode: vi.fn(),
}));

const campaign: Campaign = {
    id: "campaign-1",
    merchantId: "merchant-1",
    name: "Live campaign",
    status: "active",
    priority: 0,
    rule: { trigger: "purchase", conditions: [], rewards: [] },
    metadata: null,
    budgetConfig: null,
    budgetUsed: null,
    expiresAt: null,
    publishedAt: "2024-01-01T00:00:00Z",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    bankDistributionStatus: "distributing",
};

const START = "2025-06-01T00:00:00.000Z";

beforeEach(() => {
    vi.clearAllMocks();
});

describe("useUpdateCampaignConfig", () => {
    test("sends startDate/expiresAt to the API in live mode", async ({
        queryWrapper,
    }: TestContext) => {
        vi.mocked(useIsDemoMode).mockReturnValue(false);
        vi.mocked(updateCampaign).mockResolvedValue(campaign);

        const { result } = renderHook(() => useUpdateCampaignConfig(), {
            wrapper: queryWrapper.wrapper,
        });
        await result.current.mutateAsync({
            merchantId: "merchant-1",
            campaignId: "campaign-1",
            campaign,
            startDate: START,
            expiresAt: null,
        });

        expect(updateCampaign).toHaveBeenCalledWith({
            merchantId: "merchant-1",
            campaignId: "campaign-1",
            startDate: START,
            expiresAt: null,
            budgetConfig: undefined,
        });
    });

    test("patches the campaign locally in demo mode (no API call)", async ({
        queryWrapper,
    }: TestContext) => {
        vi.mocked(useIsDemoMode).mockReturnValue(true);

        const { result } = renderHook(() => useUpdateCampaignConfig(), {
            wrapper: queryWrapper.wrapper,
        });
        const updated = await result.current.mutateAsync({
            merchantId: "merchant-1",
            campaignId: "campaign-1",
            campaign,
            startDate: START,
            expiresAt: "2025-12-31T00:00:00.000Z",
        });

        expect(updateCampaign).not.toHaveBeenCalled();
        expect(updated.expiresAt).toBe("2025-12-31T00:00:00.000Z");
        // Start date is encoded back into the ruleset's time.timestamp gate.
        expect(getStartDate(updated.rule)).toBe(START);
    });

    test("sends budgetConfig to the API in live mode", async ({
        queryWrapper,
    }: TestContext) => {
        vi.mocked(useIsDemoMode).mockReturnValue(false);
        vi.mocked(updateCampaign).mockResolvedValue(campaign);

        const budgetConfig = [
            { label: "Daily", durationInSeconds: 86400, amount: 250 },
        ];
        const { result } = renderHook(() => useUpdateCampaignConfig(), {
            wrapper: queryWrapper.wrapper,
        });
        await result.current.mutateAsync({
            merchantId: "merchant-1",
            campaignId: "campaign-1",
            campaign,
            budgetConfig,
        });

        expect(updateCampaign).toHaveBeenCalledWith({
            merchantId: "merchant-1",
            campaignId: "campaign-1",
            startDate: undefined,
            expiresAt: undefined,
            budgetConfig,
        });
    });
});
