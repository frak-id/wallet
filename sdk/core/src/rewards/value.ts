import type { EstimatedReward, TokenAmountType } from "../types";

/**
 * Comparable fiat value of a single reward, used to rank rewards against each
 * other.
 *
 * - `fixed`      → the token amount in the requested currency
 * - `tiered`     → the highest token amount across tiers
 * - `percentage` → the capped (`maxAmount`) value when present, otherwise `0`
 *                  (an uncapped percentage has no comparable fiat value)
 */
export function getRewardValue(
    reward: EstimatedReward,
    key: keyof TokenAmountType
): number {
    switch (reward.payoutType) {
        case "fixed":
            return reward.amount[key];
        case "percentage":
            return reward.maxAmount?.[key] ?? 0;
        case "tiered":
            return reward.tiers.reduce(
                (max, tier) =>
                    "amount" in tier ? Math.max(max, tier.amount[key]) : max,
                0
            );
    }
}

// Highest percent a reward exposes (flat percentage, or the richest percent
// tier), or 0 when it carries none. Mirrors what `formatEstimatedReward`
// renders as "X %" when a reward has no money value.
function maxRewardPercent(reward: EstimatedReward): number {
    if (reward.payoutType === "percentage") return reward.percent;
    if (reward.payoutType === "tiered") {
        return reward.tiers.reduce(
            (max, tier) =>
                "percent" in tier ? Math.max(max, tier.percent) : max,
            0
        );
    }
    return 0;
}

// A reward with no money value (an uncapped percentage, or a percent-only
// tier set) still renders as "X %", so it is worth surfacing. We give it a
// positive ranking weight derived from its percent but scaled far below any
// real-money reward, so the two invariants the UI relies on hold: (1) a reward
// with real money always outranks a percentage-only reward, and (2) a
// percentage-only reward still outranks a zero-value reward. Together they
// guarantee the reward the ranking picks is always one we can display.
const PERCENT_ONLY_RANK_WEIGHT = 1e-6;

/**
 * Ranking weight used to pick the single most attractive reward to surface.
 *
 * Mirrors {@link getRewardValue} (money value) but lifts a percentage-only
 * reward to a tiny positive weight instead of `0`, so it is never buried
 * behind a zero-value reward when choosing what to display.
 */
export function getRewardRank(
    reward: EstimatedReward,
    key: keyof TokenAmountType
): number {
    const value = getRewardValue(reward, key);
    if (value > 0) return value;
    return maxRewardPercent(reward) * PERCENT_ONLY_RANK_WEIGHT;
}
