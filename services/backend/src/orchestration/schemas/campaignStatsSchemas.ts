import { t } from "@backend-utils";
import type { Static } from "elysia";

export const CampaignStatsItemSchema = t.Object({
    campaignId: t.String(),
    campaignName: t.String(),
    trigger: t.String(),
    tokenAddress: t.Union([t.Hex(), t.Null()]),
    referredInteractions: t.Number(),
    purchaseInteractions: t.Number(),
    totalRewards: t.Number(),
    uniqueWallets: t.Number(),
    ambassador: t.Number(),
    sharingRate: t.Number(),
    ctr: t.Number(),
    costPerPurchase: t.Number(),
    costPerShare: t.Number(),
});

export type CampaignStatsItem = Static<typeof CampaignStatsItemSchema>;

export const CampaignStatsResponseSchema = t.Object({
    stats: t.Array(CampaignStatsItemSchema),
});
export type CampaignStatsResponse = Static<typeof CampaignStatsResponseSchema>;
