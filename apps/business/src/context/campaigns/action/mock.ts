import type { Address } from "viem";
import campaignStatsData from "@/mock/campaignStats.json";
import campaignsData from "@/mock/campaigns.json";
import type {
    Campaign,
    CampaignActions,
    CampaignStatus,
    CampaignWithActions,
} from "@/types/Campaign";

/**
 * Map campaign status to available actions
 */
function mapStatusToActions(status: CampaignStatus): CampaignActions {
    return {
        canEdit: status === "draft",
        canDelete: status === "draft",
        canPublish: status === "draft",
        canPause: status === "active",
        canResume: status === "paused",
        canArchive: status === "active" || status === "paused",
    };
}

/**
 * Mock implementation of getMyCampaigns for demo mode
 * Returns mock campaign data with a realistic delay
 */
export async function getMyCampaignsMock(): Promise<CampaignWithActions[]> {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Map campaigns to include actions based on status
    return (campaignsData as unknown as Campaign[]).map((campaign) => ({
        ...campaign,
        actions: mapStatusToActions(campaign.status),
    }));
}

/**
 * Mock implementation of getMyCampaignsStats for demo mode
 * Returns mock campaign statistics with a realistic delay
 */
export async function getMyCampaignsStatsMock(): Promise<
    Array<{
        title: string;
        id: string;
        bank: Address;
        token: Address;
        eventType: string;
        openInteractions: number;
        readInteractions: number;
        referredInteractions: number;
        createReferredLinkInteractions: number;
        purchaseInteractions: number;
        totalRewards: bigint;
        uniqueWallets: number;
        ambassador: number;
        sharingRate: number;
        ctr: number;
        amountSpent: number;
        costPerShare: number;
        costPerPurchase: number;
        customerMeetingInteractions: number;
    }>
> {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 400));

    // Return the mock stats data with proper typing to match the real function return
    // biome-ignore lint/suspicious/noExplicitAny: Mock JSON data needs type assertion for Address fields
    return campaignStatsData as any;
}

/**
 * Mock implementation of getCampaignDetails for demo mode
 * Returns campaign details by ID from mock data
 */
export async function getCampaignDetailsMock({
    campaignId,
}: {
    campaignId: string;
}): Promise<Campaign | null> {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 250));

    // Find the campaign by ID
    const campaign = (campaignsData as unknown as Campaign[]).find(
        (c) => c.id === campaignId
    );

    if (!campaign) {
        return null;
    }

    return campaign;
}
