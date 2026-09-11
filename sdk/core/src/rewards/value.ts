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

/**
 * Highest percent a reward exposes: the flat `percentage` percent, or the
 * richest percent across `tiered` tiers, or `0` when it carries none.
 *
 * Shared by {@link getRewardRank} (to weight a percentage-only reward) and
 * `formatEstimatedReward` (to render it as `"X %"`), so the value the UI ranks
 * by and the value it prints stay derived from one tier traversal.
 */
export function maxRewardPercent(reward: EstimatedReward): number {
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

// Scaled far below any real-money reward so both display invariants hold: real
// money outranks a percentage-only reward, which outranks a zero-value one.
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

/**
 * Whether `reward` is computed over the `productScope`-matched line items
 * rather than the whole basket.
 *
 * Distinct from a campaign merely *carrying* a `productScope`, which can still
 * pay a percentage of the whole basket when the scope is a pure eligibility
 * gate. Surfaces rendering "% of basket" vs "% of eligible products" must
 * branch on this, not on the campaign-level scope flag.
 */
export function isMatchedItemsBasis(reward: EstimatedReward): boolean {
    switch (reward.payoutType) {
        case "percentage":
            return reward.percentOf === "matched_items_amount";
        case "tiered":
            return (
                reward.tierField === "purchase.matchedAmount" ||
                reward.tierField === "purchase.matchedQuantity"
            );
        case "fixed":
            return false;
    }
}
