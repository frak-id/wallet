import { pricingRepository, type TokenPrice } from "@backend-infrastructure";
import type { Address } from "viem";
import { roundAmount } from "../../../utils/numeric";
import type { CampaignRuleSelect } from "../db/schema";
import type { CampaignRuleRepository } from "../repositories/CampaignRuleRepository";
import {
    type EstimatedReward,
    type EstimatedRewardItem,
    type EstimatedRewardsResult,
    type FixedRewardDefinition,
    type PercentageRewardDefinition,
    type RewardDefinition,
    type SubscriptionEstimatedRewards,
    subscriptionStepBy,
    type TieredRewardDefinition,
} from "../schemas";

/** Ranges where no definition starts or ends, so each range pays one reward per side. */
function stepRanges(
    rewards: RewardDefinition[]
): { from: number; to: number }[] {
    const last = rewards.reduce(
        (max, def) => Math.max(max, def.cycles?.to ?? 0),
        0
    );
    const starts = new Set([1, 2]);
    for (const def of rewards) {
        if (!def.cycles) continue;
        starts.add(def.cycles.from);
        starts.add(def.cycles.to + 1);
    }
    const sorted = [...starts].filter((n) => n <= last).sort((a, b) => a - b);
    return sorted.map((from, i) => ({
        from,
        to: (sorted[i + 1] ?? last + 1) - 1,
    }));
}

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
        return {
            rewards: campaigns.map((campaign) =>
                this.buildCampaignRewardItem(campaign, priceMap)
            ),
        };
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

    private buildCampaignRewardItem(
        campaign: CampaignRuleSelect,
        priceMap: Map<Address, TokenPrice>
    ): EstimatedRewardItem {
        const { trigger, rewards: rewardDefs } = campaign.rule;

        const subscription = campaign.rule.subscription
            ? this.buildSubscriptionEstimate(campaign, priceMap)
            : undefined;

        const firstPayment = subscription?.steps.find(
            (range) => range.from === 1
        );
        let referrer: EstimatedReward | undefined = firstPayment?.referrer;
        let referee: EstimatedReward | undefined = firstPayment?.referee;
        let campaignToken: Address | undefined;

        for (const rewardDef of rewardDefs) {
            const token = rewardDef.token as Address | undefined;
            if (token) {
                campaignToken = token;
            }
            if (subscription) continue;
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
            name: campaign.name,
            interactionTypeKey: trigger,
            referrer,
            referee,
            conditions: campaign.rule.conditions,
            productScope: campaign.rule.productScope,
            defaultLockupSeconds: campaign.rule.defaultLockupSeconds,
            pendingRewardExpirationDays:
                campaign.rule.pendingRewardExpirationDays,
            maxRewardsPerUser: campaign.rule.maxRewardsPerUser,
            merchantMaxRewardsPerUser: campaign.rule.merchantMaxRewardsPerUser,
            expiresAt: campaign.expiresAt?.toISOString() ?? null,
            subscription,
        };
    }

    /** A plan's rewards by step range; the first payment always gets its own range. */
    private buildSubscriptionEstimate(
        campaign: CampaignRuleSelect,
        priceMap: Map<Address, TokenPrice>
    ): SubscriptionEstimatedRewards {
        const { rewards, subscription } = campaign.rule;
        const stepBy = subscriptionStepBy(campaign.rule);
        const stepAmount =
            stepBy === "amount" ? subscription?.stepAmount : undefined;
        const steps = stepRanges(rewards).flatMap(({ from, to }) => {
            const side = this.sideAtStep(rewards, from, stepAmount, priceMap);
            return side.referrer || side.referee ? [{ from, to, ...side }] : [];
        });
        return { steps, stepBy };
    }

    /** Each side's reward on one plan step; an amount step's percentage is its exact amount. */
    private sideAtStep(
        rewards: RewardDefinition[],
        step: number,
        stepAmount: number | undefined,
        priceMap: Map<Address, TokenPrice>
    ): { referrer?: EstimatedReward; referee?: EstimatedReward } {
        const side: { referrer?: EstimatedReward; referee?: EstimatedReward } =
            {};
        for (const def of rewards) {
            if (!def.cycles || def.cycles.from > step || step > def.cycles.to) {
                continue;
            }
            const token = def.token as Address | undefined;
            const price = token ? priceMap.get(token) : undefined;
            side[def.recipient] =
                step > 1 &&
                stepAmount !== undefined &&
                def.amountType === "percentage"
                    ? this.buildAmountStepEstimate(def, stepAmount, price)
                    : this.buildEstimatedReward(def, price);
        }
        return side;
    }

    /** A percentage of a known step amount is a fixed amount. */
    private buildAmountStepEstimate(
        rewardDef: PercentageRewardDefinition,
        stepAmount: number,
        price: TokenPrice | undefined
    ): EstimatedReward {
        let amount = (stepAmount * rewardDef.percent) / 100;
        if (rewardDef.minAmount !== undefined) {
            amount = Math.max(amount, rewardDef.minAmount);
        }
        if (rewardDef.maxAmount !== undefined) {
            amount = Math.min(amount, rewardDef.maxAmount);
        }
        return {
            payoutType: "fixed",
            amount: this.toTokenAmount(roundAmount(amount), price),
        };
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
            maxAmount:
                rewardDef.maxAmount !== undefined
                    ? this.toTokenAmount(rewardDef.maxAmount, price)
                    : undefined,
            minAmount:
                rewardDef.minAmount !== undefined
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
            tiers: rewardDef.tiers.map((tier) =>
                "percent" in tier
                    ? {
                          minValue: tier.minValue,
                          maxValue: tier.maxValue,
                          percent: tier.percent,
                      }
                    : {
                          minValue: tier.minValue,
                          maxValue: tier.maxValue,
                          amount: this.toTokenAmount(tier.amount, price),
                      }
            ),
        };
    }

    private toTokenAmount(amount: number, price: TokenPrice | undefined) {
        return {
            amount,
            eurAmount: price ? amount * price.eur : 0,
            usdAmount: price ? amount * price.usd : 0,
            gbpAmount: price ? amount * price.gbp : 0,
        };
    }
}
