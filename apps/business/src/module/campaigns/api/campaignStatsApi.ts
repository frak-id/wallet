import type { CampaignStatsItem } from "@frak-labs/backend-elysia/orchestration/schemas";
import type { Address } from "viem";
import { authenticatedBackendApi } from "@/api/backendClient";
import campaignStatsData from "@/mock/campaignStats.json";

export type CampaignStats = CampaignStatsItem & {
    createReferredLinkInteractions: number;
};

export function getMyCampaignsStatsMock(): CampaignStats[] {
    return campaignStatsData.map((stat) => ({
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

export async function getMyCampaignsStats(
    isDemoMode: boolean
): Promise<CampaignStats[]> {
    if (isDemoMode) {
        return getMyCampaignsStatsMock();
    }

    const { data: merchantsData, error: merchantsError } =
        await authenticatedBackendApi.merchant.my.get();

    if (!merchantsData || merchantsError) {
        return [];
    }

    const allMerchantIds = [
        ...merchantsData.owned.map((m) => m.id),
        ...merchantsData.adminOf.map((m) => m.id),
    ];

    const statsResults = await Promise.all(
        allMerchantIds.map(async (merchantId) => {
            const { data, error } = await authenticatedBackendApi
                .merchant({ merchantId })
                .campaigns.stats.get();
            if (!data || error) return [];
            return data.stats.map((stat) => ({
                ...stat,
                createReferredLinkInteractions: 0,
                tokenAddress: stat.tokenAddress as Address | null,
            })) as CampaignStats[];
        })
    );

    return statsResults.flat();
}
