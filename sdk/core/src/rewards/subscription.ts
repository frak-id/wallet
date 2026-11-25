import type {
    Currency,
    EstimatedReward,
    SubscriptionRewards,
    TokenAmountType,
} from "../types";
import { formatAmount } from "../utils/format/formatAmount";
import {
    formatAmountParts,
    percentAmountParts,
    type RewardAmountParts,
} from "../utils/format/formatAmountParts";
import { getCurrencyAmountKey } from "../utils/format/getCurrencyAmountKey";
import { getSupportedCurrency } from "../utils/format/getSupportedCurrency";
import { getRewardRank, getRewardValue, maxRewardPercent } from "./value";

type Audience = "referrer" | "referee";

/** What a reward prints as: a share of each payment, or a money amount. */
function isPercentBased(reward: EstimatedReward, key: keyof TokenAmountType) {
    return (
        reward.payoutType === "percentage" ||
        (getRewardValue(reward, key) === 0 && maxRewardPercent(reward) > 0)
    );
}

/** The audience's rewards across the plan, each with the number of steps it pays. */
function planRewards(
    subscription: SubscriptionRewards,
    audience: Audience
): { reward: EstimatedReward; times: number }[] {
    return subscription.steps.flatMap((range) => {
        const reward = range[audience];
        const times = range.to - range.from + 1;
        return reward && times > 0 ? [{ reward, times }] : [];
    });
}

/** Comparable value of a whole plan, so it ranks against one-shot rewards. */
export function getSubscriptionRank(
    subscription: SubscriptionRewards,
    audience: Audience,
    key: keyof TokenAmountType
): number {
    return planRewards(subscription, audience).reduce(
        (sum, { reward, times }) => sum + getRewardRank(reward, key) * times,
        0
    );
}

/** The reward a plan leads with: its first payment, else its first paid step. */
export function getLeadingReward(
    subscription: SubscriptionRewards,
    audience: Audience
): EstimatedReward | undefined {
    return planRewards(subscription, audience)[0]?.reward;
}

/** Every range pays a share of the payment, and steps follow the cycles. */
function isPercentPlan(
    subscription: SubscriptionRewards,
    rewards: ReturnType<typeof planRewards>,
    key: keyof TokenAmountType
) {
    const followsCycles =
        subscription.stepBy === undefined || subscription.stepBy === "cycle";
    return (
        followsCycles &&
        rewards.length > 0 &&
        rewards.every(({ reward }) => isPercentBased(reward, key))
    );
}

type SubscriptionRewardDisplay = {
    /** Bare, locale-neutral amount (`"30 €"`) or percentage (`"20 %"`). */
    formatted: string;
    parts: RewardAmountParts;
    /** The figure is a plan ceiling, reached only if every step is earned. */
    upTo: true;
};

/**
 * Display value of a whole plan: a percentage per payment when every range
 * pays a share of cycle payments, else the money total of all its steps.
 */
export function formatSubscriptionReward(
    subscription: SubscriptionRewards,
    audience: Audience,
    currency?: Currency
): SubscriptionRewardDisplay | undefined {
    const supportedCurrency = getSupportedCurrency(currency);
    const key = getCurrencyAmountKey(supportedCurrency);
    const rewards = planRewards(subscription, audience);

    if (isPercentPlan(subscription, rewards, key)) {
        const percent = Math.max(
            ...rewards.map(({ reward }) => maxRewardPercent(reward))
        );
        return percent > 0
            ? {
                  formatted: `${percent} %`,
                  parts: percentAmountParts(percent),
                  upTo: true,
              }
            : undefined;
    }

    const total = Math.round(
        rewards.reduce(
            (sum, { reward, times }) =>
                sum + getRewardValue(reward, key) * times,
            0
        )
    );
    return total > 0
        ? {
              formatted: formatAmount(total, supportedCurrency),
              parts: formatAmountParts(total, supportedCurrency),
              upTo: true,
          }
        : undefined;
}
