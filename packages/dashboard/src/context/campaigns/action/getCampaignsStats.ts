"use server";

import { getSafeSession } from "@/context/auth/actions/session";
import { getCampaignRepository } from "@/context/campaigns/repository/CampaignRepository";
import ky from "ky";
import { type Address, formatEther, getAddress, isAddressEqual } from "viem";

type ApiResult = {
    productId: string;
    isOwner: number; // bool
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

    // Get the readable mongodb campaign names
    const campaignRepository = await getCampaignRepository();
    const campaignDocuments = await campaignRepository.findByAddressesOrCreator(
        {
            addresses: campaignStats.map((campaign) => getAddress(campaign.id)),
        }
    );

    // Cleanly format all of the stats from string to bigint
    return campaignStats.map((campaign) => {
        // Get the matching campaign name and id
        const campaignDoc = campaignDocuments.find(
            (doc) =>
                doc.state.key === "created" &&
                isAddressEqual(doc.state.address, campaign.id)
        );

        // Map a few stuff we will use for computation
        const totalRewards = BigInt(campaign.totalRewards);
        const createReferredLinkInteractions = Number(
            campaign.createReferredLinkInteractions
        );
        const referredInteractions = Number(campaign.referredInteractions);

        // CTR = share / couverture
        const sharingRate =
            referredInteractions > 0
                ? createReferredLinkInteractions / referredInteractions
                : 0;

        // costPerShare = totalRewards / share
        const costPerShare =
            createReferredLinkInteractions > 0
                ? totalRewards / BigInt(createReferredLinkInteractions)
                : BigInt(0);

        // CPC = activation / share
        const ctr =
            createReferredLinkInteractions > 0
                ? referredInteractions / createReferredLinkInteractions
                : 0;

        // costPerResult = totalRewards / activation
        const costPerResult =
            referredInteractions > 0
                ? totalRewards / BigInt(referredInteractions)
                : BigInt(0);

        return {
            // Raw stats
            openInteractions: Number(campaign.openInteractions),
            readInteractions: Number(campaign.readInteractions),
            referredInteractions,
            createReferredLinkInteractions,
            totalRewards,
            // Polished stats for the array
            title: campaignDoc?.title ?? campaign.id,
            id: campaignDoc?._id?.toHexString() ?? campaign.id,
            amountSpent: Number.parseFloat(formatEther(totalRewards)),
            sharingRate,
            costPerShare: Number.parseFloat(formatEther(costPerShare)),
            ctr,
            costPerResult: Number.parseFloat(formatEther(costPerResult)),
        };
    });
}
