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
 * - `percentage`  → if `basketAmount` is provided, computes the actual value
 *                   (e.g. `"10 €"`), otherwise returns `"10 %"`
 * - `tiered`      → max tier value, e.g. `"50 €"`
 */
export function formatEstimatedReward(
    reward: EstimatedReward,
    currency?: Currency,
    basketAmount?: number
): string {
    const supportedCurrency = getSupportedCurrency(currency);
    const key = getCurrencyAmountKey(supportedCurrency);

    switch (reward.payoutType) {
        case "fixed":
            return formatAmount(
                Math.round(reward.amount[key]),
                supportedCurrency
            );
        case "percentage": {
            if (basketAmount !== undefined) {
                const computed = Math.round(
                    (reward.percent * basketAmount) / 100
                );
                return formatAmount(computed, supportedCurrency);
            }
            return `${reward.percent} %`;
        }
        case "tiered": {
            const max = reward.tiers.reduce(
                (acc, tier) =>
                    "amount" in tier ? Math.max(acc, tier.amount[key]) : acc,
                0
            );
            if (max > 0) {
                return formatAmount(Math.round(max), supportedCurrency);
            }
            const maxPercent = reward.tiers.reduce(
                (acc, tier) =>
                    "percent" in tier ? Math.max(acc, tier.percent) : acc,
                0
            );
            if (maxPercent > 0) {
                if (basketAmount !== undefined) {
                    return formatAmount(
                        Math.round((maxPercent * basketAmount) / 100),
                        supportedCurrency
                    );
                }
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
