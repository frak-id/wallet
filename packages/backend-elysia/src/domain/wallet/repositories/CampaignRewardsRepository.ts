import { referralCampaignAbi } from "@frak-labs/app-essentials";
import { interactionTypes } from "@frak-labs/nexus-sdk/core";
import type { KyInstance } from "ky";
import { LRUCache } from "lru-cache";
import { all, sift } from "radash";
import {
    type Address,
    type Chain,
    type Client,
    type Hex,
    type Transport,
    toHex,
} from "viem";
import { getStorageAt, multicall } from "viem/actions";

type GetCampaignResult = {
    campaigns: {
        address: Address;
        type: string;
        name: string;
        version: string;
        productId: string; // string representing a bigint
        attached: boolean;
        banking: Address;
        token: Address;
    }[];
    tokens: {
        address: Address;
        name: string;
        symbol: string;
        decimals: number;
    }[];
};

type CampaignRewards = {
    rewards: CampaignReward[];
    avg: bigint;
    avgEur: number;
    token: Address;
    decimals: number;
};

type CampaignReward = {
    interactionTypeKey: string;
    eur: number;
    amount: bigint;
};

export class CampaignRewardsRepository {
    // Cache for the campaign rewards, no expiration
    private readonly campaignRewardsCache = new LRUCache<
        Address,
        CampaignRewards
    >({
        max: 1024,
    });
    // Cache of a campaign activity, cached for 60seconds
    private readonly campaignActiveCache = new LRUCache<Address, boolean>({
        max: 1024,
        ttl: 60_000,
    });

    /**
     * Storage pointer for each interaction type
     */
    private readonly storagePtrs = Object.entries(interactionTypes).flatMap(
        ([key, subType]) =>
            Object.entries(subType).map(([subKey, typeHash]) => ({
                key: `${key}.${subKey}`,
                typeHash,
                storagePtr: toHex(
                    4565063857761385490119437627053249566272325275522255312643343188395n |
                        BigInt(typeHash)
                ),
            }))
    );

    constructor(
        private readonly client: Client<Transport, Chain>,
        private readonly indexerApi: KyInstance
    ) {}

    /**
     * Get all the rewards for a product
     * @param productId
     * @private
     */
    private async getRewardForProduct({ productId }: { productId: Hex }) {
        // Query our indexer to fetch the campaigns for the given product
        const { campaigns, tokens } = await this.indexerApi
            .get(`campaigns?productId=${productId}`)
            .json<GetCampaignResult>();
        if (!campaigns.length) return [];

        // Filter out all the non attached campaigns
        const attachedCampaigns = campaigns.filter(
            (campaign) => campaign.attached
        );

        // Check if each campaigns are active or not
        const isCampaignActives = await multicall(this.client, {
            contracts: attachedCampaigns.map(
                (campaign) =>
                    ({
                        abi: referralCampaignAbi,
                        address: campaign.address,
                        functionName: "isActive",
                    }) as const
            ),
            allowFailure: false,
        });

        // If none active early exit
        if (!isCampaignActives.some((isActive) => isActive)) {
            return [];
        }

        // Filter out all the non active campaigns
        const activeCampaigns = attachedCampaigns.filter(
            (_, index) => isCampaignActives[index]
        );

        // Fetch the rewards for each campaign
        const rewardsPromise = activeCampaigns.map(async (campaign) => {
            // Get the token for this campaign
            const token = tokens.find(
                (token) => token.address === campaign.token
            );

            // If not distribution token, don't do anything
            if (!token) return null;

            // Fetch the rewards
            return await this.fetchRewardsFromStorage({
                campaign: campaign.address,
                token,
            });
        });

        return sift(await all(rewardsPromise));
    }

    /**
     * Get the campaign rewards
     * @param address
     */
    private async fetchRewardsFromStorage({
        campaign,
    }: {
        campaign: Address;
        token: GetCampaignResult["tokens"][0];
    }): Promise<CampaignRewards> {
        const cached = this.campaignRewardsCache.get(campaign);
        if (cached) {
            return cached;
        }

        // Build our reward output
        const rewards: CampaignReward[] = [];

        // Iterate over each known storage pointer that could contain a reward
        for (const storagePtr of this.storagePtrs) {
            // Should gave us a reward trigger
            /*
                    uint192 baseReward;
            uint16 userPercent;
            uint16 deperditionPerLevel;
            uint16 maxCountPerUser;
             */
            // Find the trigger value
            const triggerValue = await getStorageAt(this.client, {
                address: campaign,
                slot: storagePtr.storagePtr,
            });
            // If that's 0, early exit
            if (!triggerValue) continue;
            // Otherwise, add it to the cache
            // todo: Should be mapped to eur
            rewards.push({
                interactionTypeKey: storagePtr.key,
                eur: 0,
                amount: BigInt(triggerValue),
            });
        }

        // If no rewards, early exit
        if (!rewards.length) {
            const final = {
                rewards,
                avg: 0n,
                avgEur: 0,
                token: "0x",
                decimals: 0,
            } as const;
            this.campaignRewardsCache.set(campaign, final);
            return final;
        }

        // Calculate the average
        const avg =
            rewards.reduce((acc, { amount }) => acc + amount, 0n) /
            BigInt(rewards.length);
        // Calculate the average in eur
        const avgEur = rewards.reduce((acc, { eur }) => acc + eur, 0);

        // Return the final result
        const final = {
            rewards,
            avg,
            avgEur,
            token: "0x",
            decimals: 0,
        } as const;
        this.campaignRewardsCache.set(campaign, final);
        return final;
    }
}
