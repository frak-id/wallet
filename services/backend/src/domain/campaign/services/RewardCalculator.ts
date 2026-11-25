import type { PricingRepository } from "@backend-infrastructure";
import type { Address } from "viem";
import { roundAmount } from "../../../utils/numeric";
import type { RecipientType } from "../../rewards/schemas";
import { subscriptionStepBy } from "../schemas";
import type {
    CalculatedReward,
    FixedRewardDefinition,
    PercentageRewardDefinition,
    ReferralChainMember,
    RewardChaining,
    RewardDefinition,
    RuleContext,
    SubscriptionRule,
    TieredRewardDefinition,
} from "../types";
import type { RuleConditionEvaluator } from "./RuleConditionEvaluator";

export type { ReferralChainMember };

type PlanParams = {
    rewards: RewardDefinition[];
    context: RuleContext;
    campaignRuleId: string;
    inactivityDays: number;
    subscription: SubscriptionRule;
    merchantDefaultToken?: Address;
};

type PlanCalculation = {
    calculated: CalculatedReward[];
    errors: string[];
    deferForUnpriceableReward: boolean;
    deferReason?: string;
};

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

    let fiatBase: number;
    if (reward.percentOf === "matched_items_amount") {
        // Missing matchedAmount means the engine never ran the productScope
        // gate (a wiring bug): hard error, never `defer`.
        if (context.purchase.matchedAmount === undefined) {
            return {
                success: false,
                error: "matched_items_amount reward requires purchase.matchedAmount",
            };
        }
        // The matched basis is recomputed from line data and can exceed what the
        // customer actually paid on a discounted order.
        fiatBase = Math.min(
            context.purchase.matchedAmount,
            context.purchase.amount
        );
    } else {
        fiatBase = context.purchase.amount;
    }

    // Order total is in fiat; convert to token units or a JPY/SEK order pays ~150x.
    const fiatAmount = (fiatBase * reward.percent) / 100;

    // Hard-error before any pricing call, so an unpriceable currency/token
    // can't turn a legitimate zero into an infinite-retry `defer`.
    if (fiatAmount <= 0) {
        return {
            success: false,
            error: "Calculated amount is zero or negative",
        };
    }

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
    if (reward.minAmount !== undefined && amount < reward.minAmount) {
        amount = reward.minAmount;
    }
    if (reward.maxAmount !== undefined && amount > reward.maxAmount) {
        amount = reward.maxAmount;
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
const FX_NORMALIZED_TIER_FIELDS = new Set([
    "purchase.amount",
    "purchase.matchedAmount",
]);

async function resolveTierValue(
    reward: TieredRewardDefinition,
    context: RuleContext,
    rawValue: number,
    merchantDefaultToken: Address | undefined,
    pricingRepository: PricingRepository
): Promise<{ value: number } | RewardCalculationResult> {
    if (!FX_NORMALIZED_TIER_FIELDS.has(reward.tierField) || !context.purchase) {
        return { value: rawValue };
    }

    // Zero converts linearly to zero token value — skip the pricing call so an
    // unpriceable currency/token can't cause an infinite-retry `defer`.
    if (rawValue <= 0) {
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

// A percent tier pays a share of the matched value, which is recomputed from
// line data and can exceed what the customer actually paid.
function clampMatchedTierValue(
    tierField: string,
    rawValue: number,
    context: RuleContext
): number {
    if (tierField !== "purchase.matchedAmount" || !context.purchase) {
        return rawValue;
    }
    return Math.min(rawValue, context.purchase.amount);
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

    const tierBase = clampMatchedTierValue(reward.tierField, rawValue, context);

    const resolved = await resolveTierValue(
        reward,
        context,
        tierBase,
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

/** What a plan step is priced on: the checkout cycle, or the plan's own step size. */
type StepBasis = "checkout" | "step";

function stepBasis(step: number, subscription: SubscriptionRule): StepBasis {
    return step === 1 || subscriptionStepBy({ subscription }) === "cycle"
        ? "checkout"
        : "step";
}

/** A later step of an amount or duration plan; `stepAmount` is already in reward-token units. */
function calculateStepReward(
    reward: RewardDefinition,
    subscription: SubscriptionRule,
    merchantDefaultToken: Address | undefined
): RewardCalculationResult {
    if (reward.amountType === "fixed") return calculateFixedReward(reward);
    if (subscriptionStepBy({ subscription }) === "duration") {
        return {
            success: false,
            error: "Duration steps only pay a fixed amount",
        };
    }
    const { stepAmount } = subscription;
    if (reward.amountType !== "percentage" || stepAmount === undefined) {
        return {
            success: false,
            error: "Only fixed or percentage rewards can pay amount steps",
        };
    }
    const token = reward.token ?? merchantDefaultToken;
    if (!token) {
        return {
            success: false,
            error: "No token to price percentage reward against",
        };
    }
    let amount = (stepAmount * reward.percent) / PERCENT_BASE;
    if (reward.minAmount !== undefined)
        amount = Math.max(amount, reward.minAmount);
    if (reward.maxAmount !== undefined)
        amount = Math.min(amount, reward.maxAmount);
    return amount > 0
        ? { success: true, amount: roundAmount(amount), token }
        : { success: false, error: "Calculated amount is zero or negative" };
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

    /**
     * Prices every step of a subscription plan. Step 1, and every step of a
     * cycle plan, prices on the checkout cycle (later cycle steps are re-priced
     * when paid); the later steps of an amount or duration plan are exact.
     */
    async calculatePlan(params: PlanParams): Promise<PlanCalculation> {
        const calculated: CalculatedReward[] = [];
        const errors: string[] = [];
        let deferForUnpriceableReward = false;
        let deferReason: string | undefined;

        for (const reward of params.rewards) {
            const outcome = await this.planReward(reward, params);
            if ("error" in outcome) {
                errors.push(outcome.error);
            } else if ("deferReason" in outcome) {
                deferForUnpriceableReward = true;
                deferReason ??= outcome.deferReason;
            } else {
                calculated.push(...outcome.rewards);
            }
        }

        return { calculated, errors, deferForUnpriceableReward, deferReason };
    }

    /** One held, numbered reward per step of the definition's range. */
    private async planReward(
        reward: RewardDefinition,
        params: PlanParams
    ): Promise<
        | { rewards: CalculatedReward[] }
        | { error: string }
        | { deferReason: string }
    > {
        const { context, subscription } = params;
        if (!reward.cycles) {
            return { error: `${reward.recipient}: Missing cycle range` };
        }

        const prices = await this.priceStepBases(reward, params);
        for (const result of prices.values()) {
            if (result.success) continue;
            return "defer" in result
                ? {
                      deferReason: `${result.reason} (${reward.recipient} ${reward.amountType} reward, currency=${context.purchase?.currency})`,
                  }
                : { error: `${reward.recipient}: ${result.error}` };
        }

        const recipient = this.resolveRecipient(reward.recipient, context);
        if (!recipient) {
            return {
                error: `${reward.recipient}: Could not resolve recipient`,
            };
        }

        const rewards: CalculatedReward[] = [];
        for (let step = reward.cycles.from; step <= reward.cycles.to; step++) {
            const result = prices.get(stepBasis(step, subscription));
            if (!result?.success) continue;
            rewards.push({
                recipient: reward.recipient,
                recipientIdentityGroupId: recipient.identityGroupId,
                type: reward.type,
                amount: result.amount,
                token: result.token,
                campaignRuleId: params.campaignRuleId,
                description: reward.description,
                expirationDays: params.inactivityDays,
                held: true,
                planStep: step,
            });
        }
        return { rewards };
    }

    /** A price per basis the range spans: the checkout, the step size, or both. */
    private async priceStepBases(
        reward: RewardDefinition,
        params: PlanParams
    ): Promise<Map<StepBasis, RewardCalculationResult>> {
        const { subscription, merchantDefaultToken } = params;
        const prices = new Map<StepBasis, RewardCalculationResult>();
        const range = reward.cycles ?? { from: 1, to: 1 };
        for (const basis of new Set([
            stepBasis(range.from, subscription),
            stepBasis(range.to, subscription),
        ])) {
            prices.set(
                basis,
                basis === "checkout"
                    ? await this.calculate(
                          reward,
                          params.context,
                          merchantDefaultToken
                      )
                    : calculateStepReward(
                          reward,
                          subscription,
                          merchantDefaultToken
                      )
            );
        }
        return prices;
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
