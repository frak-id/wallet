import type { Address } from "viem";
import type { RecipientType } from "../../rewards/schemas";
import type {
    CalculatedReward,
    FixedRewardDefinition,
    PercentageRewardDefinition,
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

    const baseAmount =
        reward.percentOf === "purchase_subtotal"
            ? (context.purchase.subtotal ?? context.purchase.amount)
            : context.purchase.amount;

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

const PERCENT_BASE = 100;

function roundAmount(amount: number): number {
    return Math.round(amount * 1_000_000) / 1_000_000;
}

function distributeChainedRewards(params: {
    totalAmount: number;
    token: Address | null;
    chaining: RewardChaining;
    referralChain: ReferralChainMember[];
    campaignRuleId: string;
    rewardType: "token";
    description?: string;
    expirationDays?: number;
    lockupDays?: number;
}): CalculatedReward[] {
    const rewards: CalculatedReward[] = [];
    let remainingAmount = params.totalAmount;

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
                type: params.rewardType,
                amount: roundAmount(rewardAmount),
                token: params.token,
                campaignRuleId: params.campaignRuleId,
                description: params.description,
                chainDepth: member.depth,
                expirationDays: params.expirationDays,
                lockupDays: params.lockupDays,
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
            default:
                return { success: false, error: "Unknown reward amount type" };
        }
    }

    calculateAll(
        rewards: RewardDefinition[],
        context: RuleContext,
        campaignRuleId: string,
        referralChain?: ReferralChainMember[],
        expirationDays?: number,
        defaultLockupDays?: number
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

            // Per-reward override > rule-level default > undefined (no lockup).
            const lockupDays = reward.lockupDays ?? defaultLockupDays;

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
                    referralChain,
                    campaignRuleId,
                    rewardType: reward.type,
                    description: reward.description,
                    expirationDays,
                    lockupDays,
                });
                calculated.push(...chainedRewards);
                continue;
            }

            const recipientData = this.resolveRecipient(
                reward.recipient,
                context
            );

            if (!recipientData) {
                errors.push(`${reward.recipient}: Could not resolve recipient`);
                continue;
            }

            calculated.push({
                recipient: reward.recipient,
                recipientIdentityGroupId: recipientData.identityGroupId,
                type: reward.type,
                amount: result.amount,
                token: result.token,
                campaignRuleId,
                description: reward.description,
                expirationDays,
                lockupDays,
            });
        }

        return { calculated, errors };
    }

    private resolveRecipient(
        recipient: RecipientType,
        context: RuleContext
    ): { identityGroupId: string } | null {
        switch (recipient) {
            case "referrer": {
                const groupId = context.attribution?.referrerIdentityGroupId;
                if (!groupId) return null;
                return {
                    identityGroupId: groupId,
                };
            }
            case "referee":
                return {
                    identityGroupId: context.user.identityGroupId,
                };
            default:
                return null;
        }
    }
}
