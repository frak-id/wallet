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
    /**
     * Sum of `interaction_logs.payload.amount` over the basket of
     * purchases that triggered a reward on this campaign. Computed once
     * per purchase (multi-recipient/multi-depth rewards do not inflate
     * the basket). Currency follows the merchant's purchase reporting —
     * the table sums numerically and displays a single currency upstream.
     */
    attributedRevenue: t.Number(),
    /** `attributedRevenue / purchaseInteractions` (0 when no purchases). */
    avgBasketValue: t.Number(),
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
