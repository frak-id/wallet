import type { EstimatedRewardItem } from "@frak-labs/backend-elysia/domain/campaign";
import type {
    Currency,
    EstimatedReward,
    InteractionTypeKey,
    TokenAmountType,
} from "@frak-labs/core-sdk";
import {
    formatAmount,
    getCurrencyAmountKey,
    getSupportedCurrency,
} from "@frak-labs/core-sdk";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { authenticatedBackendApi } from "../api/backendClient";

export function estimatedRewardsQueryOptions(merchantId?: string) {
    return queryOptions({
        queryKey: [
            "merchant",
            "estimatedRewards",
            merchantId ?? "no-merchant-id",
        ],
        queryFn: async (): Promise<EstimatedRewardItem[]> => {
            if (!merchantId) return [];

            const { data, error } = await authenticatedBackendApi.user.merchant[
                "estimated-rewards"
            ].get({
                query: { merchantId },
            });

            if (error || !data) return [];

            return data.rewards as EstimatedRewardItem[];
        },
        enabled: !!merchantId,
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
    });
}

/**
 * Format a single EstimatedReward into a display string:
 *  - fixed: "10 €"
 *  - percentage: "15 %"
 *  - tiered: "50 €" (max tier amount)
 */
export function formatEstimatedReward(
    reward: EstimatedReward,
    currency?: Currency
): string {
    const supportedCurrency = getSupportedCurrency(currency);
    const currencyAmountKey = getCurrencyAmountKey(supportedCurrency);

    switch (reward.payoutType) {
        case "fixed":
            return formatAmount(
                Math.round(reward.amount[currencyAmountKey]),
                supportedCurrency
            );

        case "percentage":
            return `${reward.percent} %`;

        case "tiered": {
            const maxTierAmount = reward.tiers.reduce(
                (max, tier) => Math.max(max, tier.amount[currencyAmountKey]),
                0
            );
            return formatAmount(Math.round(maxTierAmount), supportedCurrency);
        }
    }
}

function getRewardSortValue(
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
                (max, tier) => Math.max(max, tier.amount[key]),
                0
            );
    }
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
    return (rewards: EstimatedRewardItem[]): string | undefined => {
        if (rewards.length === 0) return undefined;

        const useReferrerReward = context !== "referred";
        const supportedCurrency = getSupportedCurrency(currency);
        const currencyAmountKey = getCurrencyAmountKey(supportedCurrency);

        const filtered = targetInteraction
            ? rewards.filter((r) => r.interactionTypeKey === targetInteraction)
            : rewards;

        const candidates = filtered
            .map((r) => (useReferrerReward ? r.referrer : r.referee))
            .filter((r): r is EstimatedReward => r !== undefined);

        if (candidates.length === 0) return undefined;

        const best = candidates.reduce((acc, current) => {
            const accValue = getRewardSortValue(acc, currencyAmountKey);
            const currentValue = getRewardSortValue(current, currencyAmountKey);
            return currentValue > accValue ? current : acc;
        });

        // A reward of 0 is not worth advertising — callers rely on `undefined`
        // to hide badges / copy (e.g. explorer card falls back to the description,
        // listener modal falls back to a locally-formatted "0 €" string).
        if (getRewardSortValue(best, currencyAmountKey) <= 0) return undefined;

        return formatEstimatedReward(best, currency);
    };
}

export function useFormattedEstimatedReward({
    merchantId,
    currency,
    targetInteraction,
    context,
}: {
    merchantId?: string;
    currency?: Currency;
    targetInteraction?: InteractionTypeKey;
    context?: string;
}) {
    return useQuery({
        ...estimatedRewardsQueryOptions(merchantId),
        select: selectFormattedReward({
            currency,
            targetInteraction,
            context,
        }),
    });
}
