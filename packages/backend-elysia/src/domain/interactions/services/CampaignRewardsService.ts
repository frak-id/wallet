import type { PricingRepository } from "@backend-common/repositories";
import { referralCampaign_isActive } from "@backend-utils";
import type { GetCampaignResponseDto } from "@frak-labs/app-essentials";
import type { KyInstance } from "ky";
import { LRUCache } from "lru-cache";
import {
    type Address,
    type Chain,
    type Client,
    type Hex,
    type Transport,
    concatHex,
    formatUnits,
    keccak256,
} from "viem";
import { multicall } from "viem/actions";
import type {
    CampaignDataRepository,
    TriggerData,
} from "../repositories/CampaignDataRepository";

export type ActiveReward = {
    campaign: Address;
    token: Address;
    interactionTypeKey: string;
    amount: number;
    eurAmount: number;
    usdAmount: number;
    triggerData: TriggerData;
};

/**
 * Service helping us to fetch all the actives campaign rewards around a product
 */
export class CampaignRewardsService {
    // Cache for the campaigns info per product
    private readonly campaignsPerProductCache = new LRUCache<
        Hex,
        GetCampaignResponseDto
    >({
        max: 128,
        ttl: 5 * 60_000,
    });

    // Cache for the active campaigns
    private readonly activeCampaignsCache = new LRUCache<Hex, boolean[]>({
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
    async getActiveRewardsForProduct({
        productId,
    }: { productId: Hex }): Promise<ActiveReward[] | undefined> {
        // Query our indexer to fetch the campaigns for the given product
        const { campaigns, tokens } = await this.getCampaignData(productId);
        if (!campaigns.length) return undefined;

        // Filter out all the non attached campaigns
        const attachedCampaigns = campaigns.filter(
            (campaign) => campaign.attached
        );

        // Filter out all the non-active campaigns
        const activeCampaigns = await this.filterActiveCampaigns({
            campaigns: attachedCampaigns,
        });
        if (!activeCampaigns.length) return undefined;

        // All the active rewards on the active campaigns
        const activeRewards: ActiveReward[] = [];

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
                    lastUpdateBlock: BigInt(campaign.lastUpdateBlock),
                });

            // Map all the rewards
            const mappedRewards = rewards.map((reward) => {
                const maxAmount =
                    "baseReward" in reward.triggerData
                        ? reward.triggerData.baseReward
                        : reward.triggerData.endReward;
                const amount = Number.parseFloat(
                    formatUnits(maxAmount, token.decimals)
                );
                return {
                    campaign: campaign.address,
                    token: token.address,
                    interactionTypeKey: reward.interactionTypeKey,
                    amount,
                    eurAmount: price.eur * amount,
                    usdAmount: price.usd * amount,
                    triggerData: reward.triggerData,
                };
            });

            // Add them to the active rewards
            activeRewards.push(...mappedRewards);
        }

        // Return everything
        return activeRewards;
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

    /**
     * Filter a list of campaigns t only get the active ones
     * @param campaigns
     * @private
     */
    private async filterActiveCampaigns({
        campaigns,
    }: { campaigns: GetCampaignResponseDto["campaigns"] }) {
        // Get initial potential value from cache
        const cacheKey = keccak256(concatHex(campaigns.map((c) => c.address)));
        const cached = this.activeCampaignsCache.get(cacheKey);

        // Check if each campaigns are active or not
        const isActives =
            cached?.length === campaigns.length
                ? cached
                : await multicall(this.client, {
                      contracts: campaigns.map(
                          (campaign) =>
                              ({
                                  abi: [referralCampaign_isActive],
                                  address: campaign.address,
                                  functionName: "isActive",
                              }) as const
                      ),
                      allowFailure: false,
                  });
        this.activeCampaignsCache.set(cacheKey, isActives);

        // Filter on the campaigns
        return campaigns.filter((_, index) => isActives[index]);
    }
}
