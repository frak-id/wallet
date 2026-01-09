import type { Address } from "viem";
import type {
    CalculatedReward,
    FixedRewardDefinition,
    PercentageRewardDefinition,
    RangeRewardDefinition,
    ReferralChainMember,
    RewardChaining,
    RewardDefinition,
    RuleContext,
    TieredRewardDefinition,
} from "../types";
import type { RuleConditionEvaluator } from "./RuleConditionEvaluator";

export type { ReferralChainMember };

type RewardCalculationResult =
    | { success: true; amount: number; token: Address | null }
    | { success: false; error: string };

function calculateFixedReward(
    reward: FixedRewardDefinition
): RewardCalculationResult {
    if (reward.amount <= 0) {
        return { success: false, error: "Fixed amount must be positive" };
    }
    return {
        success: true,
        amount: reward.amount,
        token: reward.token ?? null,
    };
}

function calculatePercentageReward(
    reward: PercentageRewardDefinition,
    context: RuleContext
): RewardCalculationResult {
    if (!context.purchase) {
        return {
            success: false,
            error: "Purchase context required for percentage reward",
        };
    }

    let baseAmount: number;
    switch (reward.percentOf) {
        case "purchase_amount":
            baseAmount = context.purchase.amount;
            break;
        case "purchase_subtotal":
            baseAmount = context.purchase.subtotal ?? context.purchase.amount;
            break;
        case "purchase_profit":
            return {
                success: false,
                error: "purchase_profit not yet supported",
            };
        default:
            return {
                success: false,
                error: `Unknown percentOf: ${reward.percentOf}`,
            };
    }

    let amount = (baseAmount * reward.percent) / 100;

    if (reward.maxAmount !== undefined && amount > reward.maxAmount) {
        amount = reward.maxAmount;
    }
    if (reward.minAmount !== undefined && amount < reward.minAmount) {
        amount = reward.minAmount;
    }

    if (amount <= 0) {
        return {
            success: false,
            error: "Calculated amount is zero or negative",
        };
    }

    return {
        success: true,
        amount: Math.round(amount * 1_000_000) / 1_000_000,
        token: reward.token ?? null,
    };
}

function calculateTieredReward(
    reward: TieredRewardDefinition,
    context: RuleContext,
    conditionEvaluator: RuleConditionEvaluator
): RewardCalculationResult {
    const tierValue = conditionEvaluator.getFieldValue(
        context,
        reward.tierField
    );

    if (typeof tierValue !== "number") {
        return {
            success: false,
            error: `Tier field ${reward.tierField} is not a number`,
        };
    }

    const sortedTiers = [...reward.tiers].sort(
        (a, b) => b.minValue - a.minValue
    );

    for (const tier of sortedTiers) {
        const meetsMin = tierValue >= tier.minValue;
        const meetsMax =
            tier.maxValue === undefined || tierValue <= tier.maxValue;

        if (meetsMin && meetsMax) {
            return {
                success: true,
                amount: tier.amount,
                token: reward.token ?? null,
            };
        }
    }

    return { success: false, error: "No matching tier found" };
}

function generateBetaRandom(alpha: number, beta: number): number {
    const u = Math.random();
    const v = Math.random();
    const x = u ** (1 / alpha);
    const y = v ** (1 / beta);
    return x / (x + y);
}

function calculateRangeReward(
    reward: RangeRewardDefinition
): RewardCalculationResult {
    if (reward.baseAmount <= 0) {
        return { success: false, error: "Base amount must be positive" };
    }
    if (reward.minMultiplier > reward.maxMultiplier) {
        return {
            success: false,
            error: "minMultiplier must be <= maxMultiplier",
        };
    }

    const betaValue = generateBetaRandom(2, 5);
    const multiplier =
        reward.minMultiplier +
        betaValue * (reward.maxMultiplier - reward.minMultiplier);
    const amount = reward.baseAmount * multiplier;

    return {
        success: true,
        amount: Math.round(amount * 1_000_000) / 1_000_000,
        token: reward.token ?? null,
    };
}

const PERCENT_BASE = 100;

function roundAmount(amount: number): number {
    return Math.round(amount * 1_000_000) / 1_000_000;
}

function distributeChainedRewards(params: {
    totalAmount: number;
    token: Address | null;
    chaining: RewardChaining;
    refereeIdentityGroupId: string;
    refereeWallet: Address | null;
    referralChain: ReferralChainMember[];
    campaignRuleId: string;
    rewardType: "token" | "discount" | "points";
    description?: string;
}): CalculatedReward[] {
    const rewards: CalculatedReward[] = [];
    let remainingAmount = params.totalAmount;

    const userAmount =
        (remainingAmount * params.chaining.userPercent) / PERCENT_BASE;
    rewards.push({
        recipient: "referee",
        recipientIdentityGroupId: params.refereeIdentityGroupId,
        recipientWallet: params.refereeWallet,
        type: params.rewardType,
        amount: roundAmount(userAmount),
        token: params.token,
        campaignRuleId: params.campaignRuleId,
        description: params.description,
        chainDepth: 0,
    });
    remainingAmount -= userAmount;

    for (let i = 0; i < params.referralChain.length; i++) {
        const member = params.referralChain[i];
        const isLast = i === params.referralChain.length - 1;

        let rewardAmount: number;
        if (isLast) {
            rewardAmount = remainingAmount;
        } else {
            rewardAmount =
                (remainingAmount * params.chaining.deperditionPerLevel) /
                PERCENT_BASE;
            remainingAmount -= rewardAmount;
        }

        if (rewardAmount > 0) {
            rewards.push({
                recipient: "referrer",
                recipientIdentityGroupId: member.identityGroupId,
                recipientWallet: null,
                type: params.rewardType,
                amount: roundAmount(rewardAmount),
                token: params.token,
                campaignRuleId: params.campaignRuleId,
                description: params.description,
                chainDepth: member.depth,
            });
        }
    }

    return rewards;
}

export class RewardCalculator {
    constructor(private readonly conditionEvaluator: RuleConditionEvaluator) {}

    calculate(
        reward: RewardDefinition,
        context: RuleContext
    ): RewardCalculationResult {
        switch (reward.amountType) {
            case "fixed":
                return calculateFixedReward(reward);
            case "percentage":
                return calculatePercentageReward(reward, context);
            case "tiered":
                return calculateTieredReward(
                    reward,
                    context,
                    this.conditionEvaluator
                );
            case "range":
                return calculateRangeReward(reward);
            default: {
                const _exhaustive: never = reward;
                return { success: false, error: "Unknown reward amount type" };
            }
        }
    }

    calculateAll(
        rewards: RewardDefinition[],
        context: RuleContext,
        campaignRuleId: string,
        referrerIdentityGroupId?: string,
        referralChain?: ReferralChainMember[]
    ): {
        calculated: CalculatedReward[];
        errors: string[];
    } {
        const calculated: CalculatedReward[] = [];
        const errors: string[] = [];

        for (const reward of rewards) {
            const result = this.calculate(reward, context);

            if (!result.success) {
                errors.push(`${reward.recipient}: ${result.error}`);
                continue;
            }

            if (reward.recipient === "referrer" && reward.chaining) {
                if (!referralChain || referralChain.length === 0) {
                    errors.push(
                        "referrer: No referral chain for chained reward"
                    );
                    continue;
                }

                const chainedRewards = distributeChainedRewards({
                    totalAmount: result.amount,
                    token: result.token,
                    chaining: reward.chaining,
                    refereeIdentityGroupId: context.user.identityGroupId,
                    refereeWallet: context.user.walletAddress,
                    referralChain,
                    campaignRuleId,
                    rewardType: reward.type,
                    description: reward.description,
                });
                calculated.push(...chainedRewards);
                continue;
            }

            const recipientData = this.resolveRecipient(
                reward.recipient,
                context,
                referrerIdentityGroupId
            );

            if (!recipientData) {
                errors.push(`${reward.recipient}: Could not resolve recipient`);
                continue;
            }

            calculated.push({
                recipient: reward.recipient,
                recipientIdentityGroupId: recipientData.identityGroupId,
                recipientWallet: recipientData.wallet,
                type: reward.type,
                amount: result.amount,
                token: result.token,
                campaignRuleId,
                description: reward.description,
            });
        }

        return { calculated, errors };
    }

    private resolveRecipient(
        recipient: "referrer" | "referee" | "user",
        context: RuleContext,
        referrerIdentityGroupId?: string
    ): { identityGroupId: string; wallet: Address | null } | null {
        switch (recipient) {
            case "referrer": {
                if (!referrerIdentityGroupId) return null;
                return {
                    identityGroupId: referrerIdentityGroupId,
                    wallet: context.attribution?.referrerWallet ?? null,
                };
            }
            case "referee":
            case "user":
                return {
                    identityGroupId: context.user.identityGroupId,
                    wallet: context.user.walletAddress,
                };
            default: {
                const _exhaustive: never = recipient;
                return null;
            }
        }
    }
}
