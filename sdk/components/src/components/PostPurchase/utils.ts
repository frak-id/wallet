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
 * - `percentage`  → e.g. `"10 %"`
 * - `tiered`      → max tier value, e.g. `"50 €"`
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
            const max = reward.tiers.reduce(
                (acc, tier) => Math.max(acc, tier.amount[key]),
                0
            );
            return formatAmount(Math.round(max), supportedCurrency);
        }
    }
}
