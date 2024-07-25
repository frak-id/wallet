"use server";

import { getSafeSession } from "@/context/auth/actions/session";
import ky from "ky";
import type { Address } from "viem";

type ApiResult = {
    contentId: string;
    isContentOwner: number; // bool
    id: Address;
    totalInteractions: string;
    openInteractions: string;
    readInteractions: string;
    referredInteractions: string;
    createReferredLinkInteractions: string;
    totalRewards: string;
}[];

/**
 * Get the current user campaigns
 */
export async function getMyCampaignsStats() {
    const session = await getSafeSession();

    // Perform the request to our api
    const campaignStats = await ky
        .get(`https://indexer.frak.id/admin/${session.wallet}/campaigns/stats`)
        .json<ApiResult>();

    if (!campaignStats) {
        return [];
    }

    // Cleanly format all of the stats from string to bigint
    return campaignStats.map((campaign) => ({
        contentId: BigInt(campaign.contentId),
        isContentOwner: campaign.isContentOwner === 1,
        id: campaign.id,
        totalInteractions: BigInt(campaign.totalInteractions),
        openInteractions: BigInt(campaign.openInteractions),
        readInteractions: BigInt(campaign.readInteractions),
        referredInteractions: BigInt(campaign.referredInteractions),
        createReferredLinkInteractions: BigInt(
            campaign.createReferredLinkInteractions
        ),
        totalRewards: BigInt(campaign.totalRewards),
    }));
}
