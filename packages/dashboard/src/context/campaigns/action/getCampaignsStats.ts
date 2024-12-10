"use server";

import { getSafeSession } from "@/context/auth/actions/session";
import { getBankTokenInfo } from "@/context/campaigns/action/getBankInfo";
import { getCampaignRepository } from "@/context/campaigns/repository/CampaignRepository";
import { indexerApi } from "@frak-labs/shared/context/server";
import { type Address, formatUnits, getAddress, isAddressEqual } from "viem";

type CampaignStats = {
    productId: string;
    isOwner: boolean;
    id: Address;
    name: string;
    bank: Address;
    totalInteractions: string;
    openInteractions: string;
    readInteractions: string;
    referredInteractions: string;
    createReferredLinkInteractions: string;
    purchaseStartedInteractions: string;
    purchaseCompletedInteractions: string;
    totalRewards: string;
};

type ApiResult = {
    stats: CampaignStats[];
    users: {
        productId: string;
        wallets: number;
    }[];
};

/**
 * Get the current user campaigns
 */
export async function getMyCampaignsStats() {
    const session = await getSafeSession();

    // Perform the request to our api
    const result = await indexerApi
        .get(`admin/${session.wallet}/campaignsStats`)
        .json<ApiResult>();

    if (!result.stats) {
        return [];
    }

    // Get the readable mongodb campaign names
    const campaignRepository = await getCampaignRepository();
    const campaignDocuments = await campaignRepository.findByAddressesOrCreator(
        {
            addresses: result.stats.map((campaign) => getAddress(campaign.id)),
        }
    );

    // Cleanly format all of the stats from string to bigint
    const mappedAsync = result.stats.map(async (campaign) => {
        // Get the matching campaign name and id
        const campaignDoc = campaignDocuments.find(
            (doc) =>
                doc.state.key === "created" &&
                isAddressEqual(doc.state.address, campaign.id)
        );
        const title = campaignDoc?.title ?? campaign.name ?? "Unknown campaign";

        // Map a few stuff we will use for computation
        const totalRewards = BigInt(campaign.totalRewards);
        const createReferredLinkInteractions = Number(
            campaign.createReferredLinkInteractions
        );
        const referredInteractions = Number(campaign.referredInteractions);
        const purchaseInteractions = Number(
            campaign.purchaseCompletedInteractions
        );

        // Get the decimals of the campaign banking
        const { decimals } = await getBankTokenInfo({ bank: campaign.bank });

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

        // costPerPurchase = totalRewards / purchaseCompleted
        const costPerPurchase =
            purchaseInteractions > 0
                ? totalRewards / BigInt(purchaseInteractions)
                : BigInt(0);

        // Unique wallet
        const uniqueWallets =
            result.users.find(
                (w) => BigInt(w.productId) === BigInt(campaign.productId)
            )?.wallets ?? 0;
        let ambassador = uniqueWallets - referredInteractions;
        if (ambassador <= 0) {
            ambassador = referredInteractions > 0 ? 1 : 0;
        }

        return {
            title,
            id: campaignDoc?._id?.toHexString() ?? campaign.id,
            // Raw stats
            openInteractions: Number(campaign.openInteractions),
            readInteractions: Number(campaign.readInteractions),
            referredInteractions,
            createReferredLinkInteractions,
            purchaseInteractions,
            totalRewards,
            uniqueWallets,
            ambassador,
            // Polished stats for the array
            sharingRate,
            ctr,
            amountSpent: Number.parseFloat(formatUnits(totalRewards, decimals)),
            costPerShare: Number.parseFloat(
                formatUnits(costPerShare, decimals)
            ),
            costPerPurchase: Number.parseFloat(
                formatUnits(costPerPurchase, decimals)
            ),
        };
    });

    return Promise.all(mappedAsync);
}
