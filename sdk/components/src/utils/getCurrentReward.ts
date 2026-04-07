import {
    type EstimatedReward,
    getCurrencyAmountKey,
    getSupportedCurrency,
    type InteractionTypeKey,
    type TokenAmountType,
} from "@frak-labs/core-sdk";
import { getMerchantInformation } from "@frak-labs/core-sdk/actions";
import { formatEstimatedReward } from "./formatReward";

type GetCurrentRewardParams = {
    targetInteraction?: InteractionTypeKey;
    /**
     * Optional basket / order amount (in the merchant's currency).
     * Used to compute percentage-based rewards as an absolute value.
     * When omitted, percentage rewards display as `"X %"`.
     */
    basketAmount?: number;
};

/**
 * Get the comparable fiat value of a reward for ranking purposes.
 */
function getRewardValue(
    reward: EstimatedReward,
    key: keyof TokenAmountType,
    basketAmount?: number
): number {
    switch (reward.payoutType) {
        case "fixed":
            return reward.amount[key];
        case "tiered":
            return reward.tiers.reduce(
                (acc, tier) => Math.max(acc, tier.amount[key]),
                0
            );
        case "percentage":
            return basketAmount ? (reward.percent * basketAmount) / 100 : 0;
    }
}

export async function getCurrentReward({
    targetInteraction,
    basketAmount,
}: GetCurrentRewardParams) {
    const client = window.FrakSetup?.client;
    if (!client) {
        console.warn("Frak client not ready yet");
        return;
    }

    const { rewards } = await getMerchantInformation(client);

    const filteredRewards = targetInteraction
        ? rewards.filter((r) => r.interactionTypeKey === targetInteraction)
        : rewards;

    // Collect all referrer rewards
    const referrerRewards = filteredRewards
        .map((r) => r.referrer)
        .filter((r): r is EstimatedReward => r !== undefined);

    if (referrerRewards.length === 0) return;

    const currency = client.config.metadata?.currency;
    const supportedCurrency = getSupportedCurrency(currency);
    const key = getCurrencyAmountKey(supportedCurrency);

    // Find the best reward by comparable value
    let bestReward = referrerRewards[0];
    let bestValue = getRewardValue(bestReward, key, basketAmount);

    for (let i = 1; i < referrerRewards.length; i++) {
        const value = getRewardValue(referrerRewards[i], key, basketAmount);
        if (value > bestValue) {
            bestReward = referrerRewards[i];
            bestValue = value;
        }
    }

    // If best value is 0, fall back to a percentage reward (displays as "X %")
    if (bestValue <= 0) {
        const percentageReward = referrerRewards.find(
            (r) => r.payoutType === "percentage"
        );
        if (!percentageReward) return;
        bestReward = percentageReward;
    }

    return formatEstimatedReward(bestReward, currency, basketAmount);
}
