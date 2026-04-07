import {
    type Currency,
    type EstimatedReward,
    type GetMerchantInformationReturnType,
    getCurrencyAmountKey,
    getSupportedCurrency,
    type InteractionTypeKey,
    type TokenAmountType,
} from "@frak-labs/core-sdk";
import { getMerchantInformation } from "@frak-labs/core-sdk/actions";
import { useEffect, useState } from "preact/hooks";
import { formatEstimatedReward } from "@/utils/formatReward";

/**
 * Get the comparable fiat value of a reward for ranking purposes.
 */
function getRewardValue(
    reward: EstimatedReward,
    key: keyof TokenAmountType
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
            return 0;
    }
}

/**
 * Pick the best referrer reward from merchant info and format it.
 * Returns `undefined` when no displayable reward is found.
 */
function resolveBestReward(
    { rewards }: GetMerchantInformationReturnType,
    currency: Currency | undefined,
    targetInteraction?: InteractionTypeKey
): string | undefined {
    const filteredRewards = targetInteraction
        ? rewards.filter((r) => r.interactionTypeKey === targetInteraction)
        : rewards;

    const referrerRewards = filteredRewards
        .map((r) => r.referrer)
        .filter((r): r is EstimatedReward => r !== undefined);

    if (referrerRewards.length === 0) return undefined;

    const supportedCurrency = getSupportedCurrency(currency);
    const key = getCurrencyAmountKey(supportedCurrency);

    // Find the best reward by comparable value
    let bestReward = referrerRewards[0];
    let bestValue = getRewardValue(bestReward, key);

    for (let i = 1; i < referrerRewards.length; i++) {
        const value = getRewardValue(referrerRewards[i], key);
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
        if (!percentageReward) return undefined;
        bestReward = percentageReward;
    }

    return formatEstimatedReward(bestReward, currency);
}

/**
 * Hook to fetch and format the best referrer reward for a given interaction type.
 *
 * Calls `getMerchantInformation`, picks the highest-value referrer reward
 * across all matching campaigns, and returns it as a formatted string.
 *
 * @param shouldUseReward - Whether to fetch the reward at all
 * @param targetInteraction - Optional filter by interaction type (e.g. "purchase")
 * @returns Object containing the formatted reward string, or undefined if unavailable
 */
export function useReward(
    shouldUseReward: boolean,
    targetInteraction?: InteractionTypeKey
) {
    const [reward, setReward] = useState<string | undefined>(undefined);

    useEffect(() => {
        if (!shouldUseReward) return;

        const client = window.FrakSetup?.client;
        if (!client) return;

        getMerchantInformation(client)
            .then((merchantInfo) => {
                const currency = client.config.metadata?.currency;
                const formatted = resolveBestReward(
                    merchantInfo,
                    currency,
                    targetInteraction
                );
                if (formatted) {
                    setReward(formatted);
                }
            })
            .catch(() => {
                // Silently swallow — reward text is non-critical
            });
    }, [shouldUseReward, targetInteraction]);

    return { reward };
}
