export const CAMPAIGN_DETAILS_TABS = [
    "funnel",
    "ambassadors",
    "config",
] as const;
export type CampaignDetailsTab = (typeof CAMPAIGN_DETAILS_TABS)[number];
