import {
    type Currency,
    type EstimatedReward,
    type GetMerchantInformationReturnType,
    getCurrencyAmountKey,
    getSupportedCurrency,
    type InteractionTypeKey,
} from "@frak-labs/core-sdk";
import { getMerchantInformation } from "@frak-labs/core-sdk/actions";
import {
    formatEstimatedReward,
    getRewardValue,
    selectBestReward,
} from "@frak-labs/rewards";
import { useEffect, useState } from "preact/hooks";

/**
 * Pick the best referrer reward from merchant info and format it.
 * Returns `undefined` when no displayable reward is found.
 */
function resolveBestReward(
    { rewards }: GetMerchantInformationReturnType,
    currency: Currency | undefined,
    targetInteraction?: InteractionTypeKey
): string | undefined {
    const best = selectBestReward(rewards, { currency, targetInteraction });
    if (!best) return undefined;

    const key = getCurrencyAmountKey(getSupportedCurrency(currency));

    // When the best comparable value is 0 (e.g. only uncapped percentages),
    // fall back to a percentage reward so it still displays as "X %".
    if (getRewardValue(best, key) <= 0) {
        const percentageReward = (
            targetInteraction
                ? rewards.filter(
                      (r) => r.interactionTypeKey === targetInteraction
                  )
                : rewards
        )
            .map((r) => r.referrer)
            .find((r): r is EstimatedReward => r?.payoutType === "percentage");
        if (!percentageReward) return undefined;
        return formatEstimatedReward(percentageReward, currency);
    }

    return formatEstimatedReward(best, currency);
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
