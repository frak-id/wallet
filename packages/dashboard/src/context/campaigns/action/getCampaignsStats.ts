"use server";

import { getSafeSession } from "@/context/auth/actions/session";
import ky from "ky";
import { type Address, formatEther } from "viem";

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
    return campaignStats.map((campaign) => {
        // Map a few stuff we will use for computation
        const totalRewards = BigInt(campaign.totalRewards);
        const createReferredLinkInteractions = Number(
            campaign.createReferredLinkInteractions
        );
        const referredInteractions = Number(campaign.referredInteractions);

        // CTR = share / couverture
        const ctr =
            referredInteractions > 0
                ? createReferredLinkInteractions / referredInteractions
                : 0;

        // costPerShare = totalRewards / share
        const costPerShare =
            createReferredLinkInteractions > 0
                ? totalRewards / BigInt(createReferredLinkInteractions)
                : BigInt(0);

        // CPC = activation / share
        const cpc =
            createReferredLinkInteractions > 0
                ? referredInteractions / createReferredLinkInteractions
                : 0;

        // costPerResult = totalRewards / activation
        const costPerResult =
            referredInteractions > 0
                ? totalRewards / BigInt(referredInteractions)
                : BigInt(0);

        return {
            contentId: BigInt(campaign.contentId),
            isContentOwner: campaign.isContentOwner === 1,
            id: campaign.id,
            // Raw stats
            totalInteractions: Number(campaign.totalInteractions),
            openInteractions: Number(campaign.openInteractions),
            readInteractions: Number(campaign.readInteractions),
            referredInteractions,
            createReferredLinkInteractions,
            totalRewards,
            // Polished stats for the array
            title: campaign.id,
            amountSpent: Number.parseFloat(formatEther(totalRewards)).toFixed(
                2
            ),
            ctr,
            costPerShare: Number.parseFloat(formatEther(costPerShare)).toFixed(
                2
            ),
            cpc,
            costPerResult: Number.parseFloat(
                formatEther(costPerResult)
            ).toFixed(2),
        };
    });
}
