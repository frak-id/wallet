import { t } from "@backend-utils";

export const CampaignStatsItemSchema = t.Object({
    campaignId: t.String(),
    campaignName: t.String(),
    trigger: t.String(),
    tokenAddress: t.Union([t.Hex(), t.Null()]),
    referredInteractions: t.Number(),
    purchaseInteractions: t.Number(),
    totalRewards: t.String(),
    uniqueWallets: t.Number(),
    ambassador: t.Number(),
    sharingRate: t.Number(),
    ctr: t.Number(),
    costPerPurchase: t.String(),
    costPerShare: t.String(),
});

export const CampaignStatsResponseSchema = t.Object({
    stats: t.Array(CampaignStatsItemSchema),
});
