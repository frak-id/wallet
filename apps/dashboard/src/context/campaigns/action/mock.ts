"use server";

import type { Address } from "viem";
import campaignStatsData from "@/mock/campaignStats.json";
import campaignsData from "@/mock/campaigns.json";
import type { CampaignWithState } from "@/types/Campaign";

/**
 * Mock implementation of getMyCampaigns for demo mode
 * Returns mock campaign data with a realistic delay
 */
export async function getMyCampaignsMock(): Promise<CampaignWithState[]> {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Return the mock data with proper typing
    return campaignsData as unknown as CampaignWithState[];
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
}) {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 250));

    // Find the campaign by ID
    const campaign = campaignsData.find((c) => c._id === campaignId);

    if (!campaign) {
        return null;
    }

    // Return campaign with id field matching the real getCampaignDetails format
    // The _id will be undefined, and id contains the campaign ID
    return {
        // biome-ignore lint/suspicious/noExplicitAny: Mock data type assertion needed for demo mode
        ...(campaign as any),
        _id: undefined,
        id: campaign._id,
    };
}

/**
 * Mock implementation of getOnChainCampaignsDetails for demo mode
 * Returns mock on-chain campaign details
 */
export async function getOnChainCampaignsDetailsMock({
    campaignAddress,
}: {
    campaignAddress: Address;
}) {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Find the campaign by address
    const campaign = campaignsData.find(
        (c) =>
            c.state.key === "created" &&
            c.state.address?.toLowerCase() === campaignAddress.toLowerCase()
    );

    if (!campaign || campaign.state.key !== "created") {
        return null;
    }

    // Convert dates to timestamps (as numbers for JavaScript compatibility)
    const dateStart = campaign.scheduled?.dateStart
        ? Math.floor(new Date(campaign.scheduled.dateStart).getTime() / 1000)
        : 0;
    const dateEnd = campaign.scheduled?.dateEnd
        ? Math.floor(new Date(campaign.scheduled.dateEnd).getTime() / 1000)
        : 0;

    const capConfig = {
        period: 86400, // 1 day in seconds
        amount: BigInt(campaign.budget.maxEuroDaily * 1000000), // Mock amount
    };

    const activationPeriod = {
        start: dateStart, // Regular number for JavaScript Date compatibility
        end: dateEnd,
    };

    const bankAddress = (campaign.bank ||
        "0x0000000000000000000000000000000000000000") as Address;

    // Return mock on-chain data matching the referralCampaignAbi.getConfig structure
    // Config is a tuple with 3 elements: [capConfig, activationPeriod, bank]
    return {
        productId: campaign.productId,
        metadata: {
            name: campaign.title,
            version: "1.0.0",
        },
        isActive: campaign.state.isActive ?? false,
        isRunning: campaign.state.isRunning ?? false,
        isAllowedToEdit: campaign.actions.canEdit,
        // biome-ignore lint/suspicious/noExplicitAny: Type assertion needed to match Viem's ABI-inferred tuple type from multicall
        config: [capConfig, activationPeriod, bankAddress] as any,
    };
}
