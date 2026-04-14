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
                (acc, tier) => Math.max(acc, tier.amount[key]),
                0
            );
            return formatAmount(Math.round(max), supportedCurrency);
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
    return reward ? text.replace("{REWARD}", reward) : text.replace("{REWARD}", "");
}
