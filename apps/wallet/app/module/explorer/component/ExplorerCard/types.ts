/**
 * Explorer merchant item shape matching the backend response.
 * Fields not yet returned by the backend use static defaults in the UI.
 */
export type ExplorerMerchantItem = {
    id: string;
    name: string;
    domain: string;
    explorerConfig: {
        heroImageUrl?: string;
        detailHeroImageUrl?: string;
        detailImages?: string[];
        logoUrl?: string;
        description?: string;
        detailDescription?: string;
    } | null;
    activeCampaignCount: number;
    maxRewardEur?: number;
    endDate?: string;
    referrerRewardEur?: number;
    refereeRewardEur?: number;
};
