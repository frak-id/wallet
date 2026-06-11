import type { PricingRepository } from "@backend-infrastructure";
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
    | { success: false; error: string }
    | {
          success: false;
          defer: true;
          reason: "fx_rate_unavailable" | "token_price_unavailable";
      };

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

async function calculatePercentageReward(
    reward: PercentageRewardDefinition,
    context: RuleContext,
    merchantDefaultToken: Address | undefined,
    pricingRepository: PricingRepository
): Promise<RewardCalculationResult> {
    if (!context.purchase) {
        return {
            success: false,
            error: "Purchase context required for percentage reward",
        };
    }

    const token = reward.token ?? merchantDefaultToken;
    if (!token) {
        return {
            success: false,
            error: "No token to price percentage reward against",
        };
    }

    // Order total is in fiat; convert to token units or a JPY/SEK order pays ~150x.
    const fiatAmount = (context.purchase.amount * reward.percent) / 100;
    const conversion = await pricingRepository.convertFiatToTokenAmount({
        token,
        fiatAmount,
        currency: context.purchase.currency,
    });

    if (!conversion.converted) {
        return { success: false, defer: true, reason: conversion.reason };
    }

    // min/max cap the token payout (same unit as a fixed reward), so they are
    // applied after the fiat->token conversion.
    let amount = conversion.tokenAmount;
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
        token,
    };
}

// Tier definitions (minValue/maxValue/amount) are all denominated in the
// reward token, while purchase.amount is fiat in the order's currency —
// convert it on site or thresholds compare apples to yen.
async function resolveTierValue(
    reward: TieredRewardDefinition,
    context: RuleContext,
    rawValue: number,
    merchantDefaultToken: Address | undefined,
    pricingRepository: PricingRepository
): Promise<{ value: number } | RewardCalculationResult> {
    if (reward.tierField !== "purchase.amount" || !context.purchase) {
        return { value: rawValue };
    }

    const token = reward.token ?? merchantDefaultToken;
    if (!token) {
        return {
            success: false,
            error: "No token to price tier thresholds against",
        };
    }
    const conversion = await pricingRepository.convertFiatToTokenAmount({
        token,
        fiatAmount: rawValue,
        currency: context.purchase.currency,
    });
    if (!conversion.converted) {
        return { success: false, defer: true, reason: conversion.reason };
    }
    return { value: conversion.tokenAmount };
}

async function calculateTieredReward(
    reward: TieredRewardDefinition,
    context: RuleContext,
    conditionEvaluator: RuleConditionEvaluator,
    merchantDefaultToken: Address | undefined,
    pricingRepository: PricingRepository
): Promise<RewardCalculationResult> {
    const rawValue = conditionEvaluator.getFieldValue(
        context,
        reward.tierField
    );

    if (typeof rawValue !== "number") {
        return {
            success: false,
            error: `Tier field ${reward.tierField} is not a number`,
        };
    }

    const resolved = await resolveTierValue(
        reward,
        context,
        rawValue,
        merchantDefaultToken,
        pricingRepository
    );
    if (!("value" in resolved)) {
        return resolved;
    }
    const tierValue = resolved.value;

    const sortedTiers = [...reward.tiers].sort(
        (a, b) => b.minValue - a.minValue
    );

    for (const tier of sortedTiers) {
        const meetsMin = tierValue >= tier.minValue;
        const meetsMax =
            tier.maxValue === undefined || tierValue <= tier.maxValue;

        if (!meetsMin || !meetsMax) continue;

        // Percent tiers pay a share of the matched value; tierValue is already
        // token-denominated here (converted above), and conversion is linear,
        // so percent-of-converted == converted-percent-of-fiat.
        const amount =
            "percent" in tier
                ? roundAmount((tierValue * tier.percent) / PERCENT_BASE)
                : tier.amount;

        if (amount <= 0) {
            return {
                success: false,
                error: "Calculated amount is zero or negative",
            };
        }

        return {
            success: true,
            amount,
            token: reward.token ?? null,
        };
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
    lockupSeconds?: number;
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
                lockupSeconds: params.lockupSeconds,
            });
        }
    }

    return rewards;
}

export class RewardCalculator {
    constructor(
        private readonly conditionEvaluator: RuleConditionEvaluator,
        private readonly pricingRepository: PricingRepository
    ) {}

    async calculate(
        reward: RewardDefinition,
        context: RuleContext,
        merchantDefaultToken?: Address
    ): Promise<RewardCalculationResult> {
        switch (reward.amountType) {
            case "fixed":
                return calculateFixedReward(reward);
            case "percentage":
                return calculatePercentageReward(
                    reward,
                    context,
                    merchantDefaultToken,
                    this.pricingRepository
                );
            case "tiered":
                return calculateTieredReward(
                    reward,
                    context,
                    this.conditionEvaluator,
                    merchantDefaultToken,
                    this.pricingRepository
                );
            default:
                return { success: false, error: "Unknown reward amount type" };
        }
    }

    async calculateAll(
        rewards: RewardDefinition[],
        context: RuleContext,
        campaignRuleId: string,
        referralChain?: ReferralChainMember[],
        expirationDays?: number,
        defaultLockupSeconds?: number,
        merchantDefaultToken?: Address
    ): Promise<{
        calculated: CalculatedReward[];
        errors: string[];
        deferForUnpriceableReward: boolean;
        deferReason?: string;
    }> {
        const calculated: CalculatedReward[] = [];
        const errors: string[] = [];
        let deferForUnpriceableReward = false;
        let deferReason: string | undefined;

        for (const reward of rewards) {
            const result = await this.calculate(
                reward,
                context,
                merchantDefaultToken
            );

            if (!result.success) {
                if ("defer" in result) {
                    deferForUnpriceableReward = true;
                    deferReason ??= `${result.reason} (${reward.recipient} ${reward.amountType} reward, currency=${context.purchase?.currency})`;
                    continue;
                }
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
                    referralChain,
                    campaignRuleId,
                    rewardType: reward.type,
                    description: reward.description,
                    expirationDays,
                    lockupSeconds: defaultLockupSeconds,
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
                lockupSeconds: defaultLockupSeconds,
            });
        }

        return { calculated, errors, deferForUnpriceableReward, deferReason };
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
