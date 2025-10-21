/**
 * Represents a single step in the funnel
 */
export type FunnelStep = {
    name: string;
    count: number;
    dropoff: number; // Percentage dropoff from previous step
};

/**
 * Funnel metrics (CPM, CPC, etc.)
 */
export type FunnelMetrics = {
    cpm: number; // Cost per Mille (1000 impressions)
    cpc: number; // Cost per Click
    sharingRate: number; // Percentage of wallets that share
    cpa: number; // Cost per Action (purchase)
    cac: number; // Cost Acquisition Client
    amountSpent: number; // Total amount spent
};

/**
 * Rewards step (common to both referrer and referred)
 */
export type FunnelRewards = {
    name: string;
    count: number;
};

/**
 * Complete funnel data for a campaign
 */
export type CampaignFunnelData = {
    title?: string; // Campaign title (not present in global)
    referrer: {
        steps: FunnelStep[];
    };
    referred: {
        steps: FunnelStep[];
    };
    rewards: FunnelRewards;
    metrics: FunnelMetrics;
};

/**
 * Full funnel response structure
 */
export type CampaignFunnelResponse = {
    global: CampaignFunnelData;
    campaigns: Record<string, CampaignFunnelData>;
};
