import { pricingRepository, type TokenPrice } from "@backend-infrastructure";
import type { TokenAmount } from "@backend-utils";
import type { Address } from "viem";
import type { CampaignRuleSelect } from "../db/schema";
import type { CampaignRuleRepository } from "../repositories/CampaignRuleRepository";
import type {
    EstimatedReward,
    EstimatedRewardItem,
    EstimatedRewardsResult,
    FixedRewardDefinition,
    PercentageRewardDefinition,
    RewardDefinition,
    TieredRewardDefinition,
} from "../schemas";

export class EstimatedRewardService {
    constructor(readonly campaignRuleRepository: CampaignRuleRepository) {}

    async getEstimatedRewards(
        merchantId: string
    ): Promise<EstimatedRewardsResult> {
        const campaigns =
            await this.campaignRuleRepository.findActiveByMerchant(merchantId);

        if (campaigns.length === 0) {
            return { rewards: [] };
        }

        const priceMap = await this.fetchTokenPrices(campaigns);
        return this.buildResult(campaigns, priceMap);
    }

    private async fetchTokenPrices(
        campaigns: CampaignRuleSelect[]
    ): Promise<Map<Address, TokenPrice>> {
        const tokenAddresses = new Set<Address>();
        for (const campaign of campaigns) {
            for (const reward of campaign.rule.rewards) {
                if (reward.token) {
                    tokenAddresses.add(reward.token as Address);
                }
            }
        }

        const priceMap = new Map<Address, TokenPrice>();
        await Promise.all(
            [...tokenAddresses].map(async (token) => {
                const price = await pricingRepository.getTokenPrice({ token });
                if (price) {
                    priceMap.set(token, price);
                }
            })
        );
        return priceMap;
    }

    private buildResult(
        campaigns: CampaignRuleSelect[],
        priceMap: Map<Address, TokenPrice>
    ): EstimatedRewardsResult {
        const rewards: EstimatedRewardItem[] = [];
        let maxReferrer: TokenAmount | undefined;
        let maxReferee: TokenAmount | undefined;

        for (const campaign of campaigns) {
            const item = this.buildCampaignRewardItem(campaign, priceMap);
            rewards.push(item);

            maxReferrer = this.updateMax(maxReferrer, item.referrer);
            maxReferee = this.updateMax(maxReferee, item.referee);
        }

        return { maxReferrer, maxReferee, rewards };
    }

    private buildCampaignRewardItem(
        campaign: CampaignRuleSelect,
        priceMap: Map<Address, TokenPrice>
    ): EstimatedRewardItem {
        const { trigger, rewards: rewardDefs } = campaign.rule;

        let referrer: EstimatedReward | undefined;
        let referee: EstimatedReward | undefined;
        let campaignToken: Address | undefined;

        for (const rewardDef of rewardDefs) {
            const token = rewardDef.token as Address | undefined;
            if (token) {
                campaignToken = token;
            }
            const price = token ? priceMap.get(token) : undefined;
            const estimated = this.buildEstimatedReward(rewardDef, price);

            if (rewardDef.recipient === "referrer") {
                referrer = estimated;
            } else if (rewardDef.recipient === "referee") {
                referee = estimated;
            }
        }

        return {
            token: campaignToken,
            campaignId: campaign.id,
            interactionTypeKey: trigger,
            referrer,
            referee,
        };
    }

    private updateMax(
        current: TokenAmount | undefined,
        estimated: EstimatedReward | undefined
    ): TokenAmount | undefined {
        if (!estimated || estimated.payoutType !== "fixed") return current;
        if (!current) return estimated.amount;
        return estimated.amount.eurAmount > current.eurAmount
            ? estimated.amount
            : current;
    }

    private buildEstimatedReward(
        rewardDef: RewardDefinition,
        price: TokenPrice | undefined
    ): EstimatedReward {
        switch (rewardDef.amountType) {
            case "fixed":
                return this.buildFixedEstimate(rewardDef, price);
            case "percentage":
                return this.buildPercentageEstimate(rewardDef, price);
            case "tiered":
                return this.buildTieredEstimate(rewardDef, price);
        }
    }

    private buildFixedEstimate(
        rewardDef: FixedRewardDefinition,
        price: TokenPrice | undefined
    ): EstimatedReward {
        return {
            payoutType: "fixed",
            amount: this.toTokenAmount(rewardDef.amount, price),
        };
    }

    private buildPercentageEstimate(
        rewardDef: PercentageRewardDefinition,
        price: TokenPrice | undefined
    ): EstimatedReward {
        return {
            payoutType: "percentage",
            percent: rewardDef.percent,
            percentOf: rewardDef.percentOf,
            maxAmount: rewardDef.maxAmount
                ? this.toTokenAmount(rewardDef.maxAmount, price)
                : undefined,
            minAmount: rewardDef.minAmount
                ? this.toTokenAmount(rewardDef.minAmount, price)
                : undefined,
        };
    }

    private buildTieredEstimate(
        rewardDef: TieredRewardDefinition,
        price: TokenPrice | undefined
    ): EstimatedReward {
        return {
            payoutType: "tiered",
            tierField: rewardDef.tierField,
            tiers: rewardDef.tiers.map((tier) => ({
                minValue: tier.minValue,
                maxValue: tier.maxValue,
                amount: this.toTokenAmount(tier.amount, price),
            })),
        };
    }

    private toTokenAmount(
        amount: number,
        price: TokenPrice | undefined
    ): TokenAmount {
        return {
            amount,
            eurAmount: price ? amount * price.eur : 0,
            usdAmount: price ? amount * price.usd : 0,
            gbpAmount: price ? amount * price.gbp : 0,
        };
    }
}
