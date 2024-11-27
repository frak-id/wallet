import {
    type GetCampaignResponseDto,
    referralCampaignAbi,
} from "@frak-labs/app-essentials";
import type { KyInstance } from "ky";
import { LRUCache } from "lru-cache";
import {
    type Address,
    type Chain,
    type Client,
    type Hex,
    type Transport,
    formatUnits,
    toHex,
} from "viem";
import { multicall } from "viem/actions";
import type { CampaignDataRepository } from "../repositories/CampaignDataRepository";
import type { PricingRepository } from "../repositories/PricingRepository";

export class CampaignRewardsService {
    // Cache for the campaigns info per product
    private readonly campaignsPerProductCache = new LRUCache<
        Hex,
        GetCampaignResponseDto
    >({
        max: 128,
        ttl: 5 * 60_000,
    });

    constructor(
        private readonly client: Client<Transport, Chain>,
        private readonly indexerApi: KyInstance,
        private readonly pricingRepository: PricingRepository,
        private readonly campaignDataRepository: CampaignDataRepository
    ) {}

    /**
     * Get all the rewards for a product
     * @param productId
     * @private
     */
    async getRewardForProduct({ productId }: { productId: Hex }) {
        // Query our indexer to fetch the campaigns for the given product
        const { campaigns, tokens } = await this.getCampaignData(productId);
        if (!campaigns.length) return undefined;

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
            return undefined;
        }

        // Filter out all the non active campaigns
        const activeCampaigns = attachedCampaigns.filter(
            (_, index) => isCampaignActives[index]
        );

        // All the active rewards on the active campaigns
        const activeRewards: {
            campaign: Address;
            token: Address;
            interactionTypeKey: string;
            rawAmount: Hex;
            amount: number;
            eurAmount: number;
        }[] = [];
        let totalPerCampaign = 0;

        // Iterate over each campaigns
        for (const campaign of activeCampaigns) {
            // Get the token for this campaign
            const token = tokens.find(
                (token) => token.address === campaign.token
            );

            // If not distribution token, don't do anything
            if (!token) continue;

            // Get the current token price
            const price = await this.pricingRepository.getTokenPrice({
                token: token.address,
            });
            if (!price) continue;

            // Fetch the rewards
            const rewards =
                await this.campaignDataRepository.getRewardsFromStorage({
                    campaign: campaign.address,
                });

            // Map all the rewards
            const mappedRewards = rewards.map((reward) => {
                const amount = Number.parseFloat(
                    formatUnits(reward.amount, token.decimals)
                );
                return {
                    campaign: campaign.address,
                    token: token.address,
                    interactionTypeKey: reward.interactionTypeKey,
                    amount,
                    eurAmount: price.eur * amount,
                    rawAmount: toHex(reward.amount),
                };
            });

            // Add them to the active rewards
            activeRewards.push(...mappedRewards);
            totalPerCampaign +=
                mappedRewards.reduce(
                    (acc, reward) => acc + reward.eurAmount,
                    0
                ) / mappedRewards.length;
        }

        // Return everything
        return {
            activeRewards,
            totalPerCampaign,
            avgPerCampaign: totalPerCampaign / activeRewards.length,
        };
    }

    /**
     * Get the campaign data for a product
     * @param productId
     * @private
     */
    private async getCampaignData(productId: Hex) {
        const cached = this.campaignsPerProductCache.get(productId);
        if (cached) {
            return cached;
        }
        const result = await this.indexerApi
            .get(`campaign?productId=${productId}`)
            .json<GetCampaignResponseDto>();
        this.campaignsPerProductCache.set(productId, result);
        return result;
    }
}
