import type {
    Currency,
    InteractionTypeKey,
    MerchantReward,
} from "@frak-labs/core-sdk";
import {
    formatBestReward,
    type RewardAudience,
} from "@frak-labs/core-sdk/rewards";
import { authenticatedBackendApi } from "../api/backendClient";
import { merchantKey } from "../queryKeys/merchant";
import { queryOptions } from "../utils/queryOptions";

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
 * Select-function factory: picks the best reward for the given context and
 * formats it, returning `undefined` when nothing is worth advertising.
 *
 * The `"referred"` context marks the viewer as the referee, so their reward
 * side is shown instead of the referrer's.
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
    const audience: RewardAudience =
        context === "referred" ? "referee" : "referrer";
    return (rewards: MerchantReward[]): string | undefined =>
        formatBestReward(rewards, { currency, targetInteraction, audience });
}
