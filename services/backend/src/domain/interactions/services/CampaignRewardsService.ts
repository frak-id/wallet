import { indexerApi, pricingRepository, viemClient } from "@backend-common";
import type { TokenPrice } from "@backend-common/repositories/PricingRepository";
import { type TokenAmount, referralCampaign_isActive } from "@backend-utils";
import type { GetCampaignResponseDto } from "@frak-labs/app-essentials";
import { LRUCache } from "lru-cache";
import {
    type Address,
    type Hex,
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
    referrer: TokenAmount;
    referee: TokenAmount;
    triggerData:
        | { baseReward: number }
        | { startReward: number; endReward: number; beta: number };
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
        ttl: 60_000,
    });

    // Cache for the active campaigns
    private readonly activeCampaignsCache = new LRUCache<Hex, boolean[]>({
        max: 128,
        ttl: 60_000,
    });

    constructor(
        private readonly campaignDataRepository: CampaignDataRepository
    ) {}

    /**
     * Get all the rewards for a product
     * @param productId
     * @param campaignId - Optional specific campaign ID to target
     * @private
     */
    async getActiveRewardsForProduct({
        productId,
        campaignId,
    }: { productId: Hex; campaignId?: Address }): Promise<
        ActiveReward[] | undefined
    > {
        // Query our indexer to fetch the campaigns for the given product
        const { campaigns, tokens } = await this.getCampaignData(productId);
        if (!campaigns.length) return undefined;

        // Filter out all the non attached campaigns
        const attachedCampaigns = campaigns.filter(
            (campaign) => campaign.attached
        );

        // Filter campaigns by scope and campaignId
        const scopedCampaigns = this.filterCampaignsByScope({
            campaigns: attachedCampaigns,
            campaignId,
        });

        // Filter out all the non-active campaigns
        const activeCampaigns = await this.filterActiveCampaigns({
            campaigns: scopedCampaigns,
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
            const price = await pricingRepository.getTokenPrice({
                token: token.address,
            });
            if (!price) continue;

            // Fetch the rewards and chaining config
            const [rewards, chainingConfig] = await Promise.all([
                this.campaignDataRepository.getRewardsFromStorage({
                    campaign: campaign.address,
                    lastUpdateBlock: BigInt(campaign.lastUpdateBlock),
                }),
                this.campaignDataRepository.getChainingConfig({
                    campaign: campaign.address,
                    lastUpdateBlock: BigInt(campaign.lastUpdateBlock),
                }),
            ]);

            // Map all the rewards
            const mappedRewards = rewards.map((reward) => {
                // Map the reward triggers
                const { maxReward, ...triggerData } = this.mapTriggerData(
                    reward.triggerData,
                    token.decimals
                );

                // Return the formated object for the reward
                return {
                    campaign: campaign.address,
                    token: token.address,
                    interactionTypeKey: reward.interactionTypeKey,
                    referrer: this.mapAmount({
                        amount: maxReward * (1 - chainingConfig.userPercent),
                        price,
                    }),
                    referee: this.mapAmount({
                        amount: maxReward * chainingConfig.userPercent,
                        price,
                    }),
                    triggerData,
                };
            });

            // Add them to the active rewards
            activeRewards.push(...mappedRewards);
        }

        // Return everything
        return activeRewards;
    }

    private mapAmount({
        amount,
        price,
    }: { amount: number; price: TokenPrice }) {
        return {
            amount: Math.floor(amount * 100) / 100,
            eurAmount: Math.floor(price.eur * amount * 100) / 100,
            usdAmount: Math.floor(price.usd * amount * 100) / 100,
            gbpAmount: Math.floor(price.gbp * amount * 100) / 100,
        };
    }

    /**
     * Map trigger data to a redeable format
     */
    private mapTriggerData(triggerData: TriggerData, decimals: number) {
        // Fora fixed reward distribution
        if ("baseReward" in triggerData) {
            const baseReward = Number.parseFloat(
                formatUnits(triggerData.baseReward, decimals)
            );
            return {
                baseReward,
                maxReward: baseReward,
            };
        }

        // For a range distribution
        const startReward = Number.parseFloat(
            formatUnits(triggerData.startReward, decimals)
        );
        const endReward = Number.parseFloat(
            formatUnits(triggerData.endReward, decimals)
        );
        const beta = Number.parseFloat(formatUnits(triggerData.betaPercent, 4));
        return {
            startReward,
            endReward,
            beta,
            maxReward: endReward,
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
        const result = await indexerApi
            .get(`campaign?productId=${productId}`)
            .json<GetCampaignResponseDto>();
        this.campaignsPerProductCache.set(productId, result);
        return result;
    }

    /**
     * Filter campaigns based on scope and provided campaignId
     * @param campaigns
     * @param campaignId
     * @private
     */
    private filterCampaignsByScope({
        campaigns,
        campaignId,
    }: {
        campaigns: GetCampaignResponseDto["campaigns"];
        campaignId?: Address;
    }) {
        return campaigns.filter((campaign) => {
            // If no scope info available, assume global (backward compatibility)
            if (!campaign.scope || campaign.scope.type === "global") {
                return true;
            }

            // For specific campaigns, campaignId must be provided and match
            if (campaign.scope.type === "specific") {
                return campaignId === campaign.address;
            }

            return false;
        });
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
                : await multicall(viemClient, {
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
