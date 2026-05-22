import type { CampaignStatsItem } from "@frak-labs/backend-elysia/orchestration/schemas";
import type { Address } from "viem";
import { authenticatedBackendApi } from "@/api/backendClient";
import campaignStatsData from "@/mock/campaignStats.json";

export type CampaignStats = CampaignStatsItem & {
    createReferredLinkInteractions: number;
};

/**
 * Returns demo stats for a given merchant.
 *
 * Mock dataset is keyed by the real merchant UUIDs from `merchants.json`
 * (same scheme as campaigns + members). When `merchantId` is omitted the
 * full dataset is returned — used only by tests that need deterministic
 * data regardless of routing.
 */
export function getMerchantCampaignsStatsMock(
    merchantId?: string
): CampaignStats[] {
    const scoped = merchantId
        ? campaignStatsData.filter((stat) => stat.merchantId === merchantId)
        : campaignStatsData;

    return scoped.map((stat) => ({
        campaignId: stat.id,
        campaignName: stat.title,
        trigger: stat.eventType.toLowerCase(),
        tokenAddress: stat.token as Address,
        referredInteractions: stat.referredInteractions,
        createReferredLinkInteractions: stat.createReferredLinkInteractions,
        purchaseInteractions: stat.purchaseInteractions,
        totalRewards: stat.totalRewards,
        uniqueWallets: stat.uniqueWallets,
        ambassador: stat.ambassador,
        sharingRate: stat.sharingRate,
        ctr: stat.ctr,
        costPerPurchase: stat.costPerPurchase,
        costPerShare: stat.costPerShare,
    }));
}

export async function getMerchantCampaignsStats({
    merchantId,
    isDemoMode,
}: {
    merchantId: string;
    isDemoMode: boolean;
}): Promise<CampaignStats[]> {
    if (isDemoMode) {
        return getMerchantCampaignsStatsMock(merchantId);
    }

    const { data, error } = await authenticatedBackendApi
        .merchant({ merchantId })
        .campaigns.stats.get();

    if (!data || error) {
        return [];
    }

    return data.stats.map((stat) => ({
        ...stat,
        createReferredLinkInteractions: 0,
        tokenAddress: stat.tokenAddress as Address | null,
    })) as CampaignStats[];
}
