import type {
    Currency,
    InteractionTypeKey,
    MerchantReward,
} from "@frak-labs/core-sdk";
import {
    getCurrencyAmountKey,
    getSupportedCurrency,
} from "@frak-labs/core-sdk";
import {
    formatEstimatedReward,
    getRewardValue,
    selectBestReward,
} from "@frak-labs/core-sdk/rewards";
import { authenticatedBackendApi } from "../api/backendClient";
import { merchantKey } from "../queryKeys/merchant";
import { queryOptions } from "../utils/queryOptions";

// Re-exported so the wallet-shared barrel stays the stable entry point for
// reward formatting (listener / install / sharing consumers import it here).
export { formatEstimatedReward };

export function estimatedRewardsQueryOptions(merchantId?: string) {
    return queryOptions({
        queryKey: merchantKey.estimatedRewards(merchantId),
        queryFn: async (): Promise<MerchantReward[]> => {
            if (!merchantId) return [];

            const { data, error } = await authenticatedBackendApi.user.merchant[
                "estimated-rewards"
            ].get({
                query: { merchantId },
            });

            if (error || !data) return [];

            return data.rewards as MerchantReward[];
        },
        enabled: !!merchantId,
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
    });
}

/**
 * Select function factory: extracts the best reward for a given context.
 * Handles referrer vs referee selection, interaction filtering, and picks the highest-value candidate.
 */
export function selectFormattedReward({
    currency,
    targetInteraction,
    context,
}: {
    currency?: Currency;
    targetInteraction?: InteractionTypeKey;
    context?: string;
}) {
    return (rewards: MerchantReward[]): string | undefined => {
        const best = selectBestReward(rewards, {
            currency,
            targetInteraction,
            context,
        });
        if (!best) return undefined;

        // A reward of 0 is not worth advertising — callers rely on `undefined`
        // to hide badges / copy (e.g. explorer card falls back to the description,
        // listener modal falls back to a locally-formatted "0 €" string).
        const key = getCurrencyAmountKey(getSupportedCurrency(currency));
        if (getRewardValue(best, key) <= 0) return undefined;

        return formatEstimatedReward(best, currency);
    };
}
