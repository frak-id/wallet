import type { Address } from "viem";
import campaignStatsData from "@/mock/campaignStats.json";

export type CampaignStats = {
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
};

export async function getMyCampaignsStats(): Promise<CampaignStats[]> {
    await new Promise((resolve) => setTimeout(resolve, 400));

    return campaignStatsData.map((stat) => ({
        ...stat,
        bank: stat.bank as Address,
        token: stat.token as Address,
        totalRewards: BigInt(stat.totalRewards),
    }));
}
