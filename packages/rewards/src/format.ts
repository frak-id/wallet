import {
    type Currency,
    type EstimatedReward,
    formatAmount,
    getCurrencyAmountKey,
    getSupportedCurrency,
} from "@frak-labs/core-sdk";

/**
 * Format an {@link EstimatedReward} into a human-readable string.
 *
 * - `fixed`      → e.g. `"5 €"`
 * - `percentage` → e.g. `"10 %"`
 * - `tiered`     → the richest tier: max token amount (e.g. `"50 €"`) or, when
 *                  tiers only carry percentages, the max percent (e.g. `"10 %"`)
 *
 * Percentages are always rendered as a `"X %"` string: the backend never sends
 * a reference basket, so the reward cannot be resolved to a concrete amount
 * here. Callers that need a worked example use the `example` helpers instead.
 */
export function formatEstimatedReward(
    reward: EstimatedReward,
    currency?: Currency
): string {
    const supportedCurrency = getSupportedCurrency(currency);
    const key = getCurrencyAmountKey(supportedCurrency);

    switch (reward.payoutType) {
        case "fixed":
            return formatAmount(
                Math.round(reward.amount[key]),
                supportedCurrency
            );

        case "percentage":
            return `${reward.percent} %`;

        case "tiered": {
            const maxAmount = reward.tiers.reduce(
                (max, tier) =>
                    "amount" in tier ? Math.max(max, tier.amount[key]) : max,
                0
            );
            if (maxAmount > 0) {
                return formatAmount(Math.round(maxAmount), supportedCurrency);
            }
            const maxPercent = reward.tiers.reduce(
                (max, tier) =>
                    "percent" in tier ? Math.max(max, tier.percent) : max,
                0
            );
            if (maxPercent > 0) {
                return `${maxPercent} %`;
            }
            return formatAmount(0, supportedCurrency);
        }
    }
}

/**
 * Replace the `{REWARD}` placeholder in a text string with a reward value.
 * If no reward is provided, returns the text with `{REWARD}` stripped.
 */
export function applyRewardPlaceholder(
    text: string,
    reward: string | undefined
): string {
    return reward
        ? text.replace("{REWARD}", reward)
        : text.replace("{REWARD}", "");
}
