import { createServerFn } from "@tanstack/react-start";
import { type Address, formatUnits } from "viem";
import { indexerApi } from "@/context/api/indexerApi";
import { authMiddleware } from "@/context/auth/authMiddleware";
import { getBankTokenInfoInternal } from "@/context/campaigns/action/getBankInfo";
import { getMyCampaignsStatsMock } from "@/context/campaigns/action/mock";

// import { getCampaignRepository } from "@/context/campaigns/repository/CampaignRepository";
// import type { CampaignGoal } from "@/types/Campaign";

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
    customerMeetingInteractions: string;
    customerMeetingCompletedInteractions?: string;
};

type ApiResult = {
    stats: CampaignStats[];
    users: {
        productId: string;
        wallets: number;
    }[];
};

/**
 * Map campaign goal types to display labels for the Event column
 */
// function mapGoalToEventType(goal?: CampaignGoal | ""): string {
//     if (!goal) return "Unknown";
//
//     const goalMap: Record<CampaignGoal, string> = {
//         sales: "Purchase",
//         awareness: "Share",
//         traffic: "Opt-in",
//         retention: "Repeat Purchase",
//         registration: "Registration",
//     };
//
//     return goalMap[goal] || "Unknown";
// }

/**
 * Get the current user campaigns stats
 */
async function getMyCampaignsStatsInternal({
    wallet,
    isDemoMode,
}: {
    wallet: Address;
    isDemoMode: boolean;
}) {
    // Check if demo mode is active
    if (isDemoMode) {
        return getMyCampaignsStatsMock();
    }

    // Perform the request to our api
    const result = await indexerApi
        .get(`admin/${wallet}/campaignsStats`)
        .json<ApiResult>();

    if (!result.stats) {
        return [];
    }

    // Cleanly format all of the stats from string to bigint
    const mappedAsync = result.stats.map(async (campaign) => {
        // TODO: Restore campaign enrichment when repository is available or use backend API
        // const campaignDoc = campaignDocuments.find(...)
        const title = campaign.name ?? "Unknown campaign";
        const eventType = "Unknown"; // mapGoalToEventType(campaignDoc?.type)

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
        const bankTokenInfo = await getBankTokenInfoInternal({
            bank: campaign.bank,
        });
        const { decimals, token } = bankTokenInfo;

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
            id: campaign.id,
            bank: campaign.bank,
            token: token,
            eventType,
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
            customerMeetingInteractions: Number(
                campaign.customerMeetingInteractions
            ),
        };
    });

    return Promise.all(mappedAsync);
}

/**
 * Server function to get campaign stats
 */
export const getMyCampaignsStats = createServerFn({ method: "GET" })
    .middleware([authMiddleware])
    .handler(async ({ context }) => {
        const { wallet, isDemoMode } = context;
        return getMyCampaignsStatsInternal({ wallet, isDemoMode });
    });
