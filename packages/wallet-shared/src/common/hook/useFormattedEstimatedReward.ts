import type {
    Currency,
    InteractionTypeKey,
    MerchantReward,
    ProductDetails,
} from "@frak-labs/core-sdk";
import {
    type BestReward,
    type RewardAudience,
    selectBestReward,
} from "@frak-labs/core-sdk/rewards";
import { useQuery } from "@tanstack/react-query";
import { estimatedRewardsQueryOptions } from "./useEstimatedReward";

/**
 * Select-function factory: the best reward for the context, formatted, with its
 * `payoutType`, or `undefined` when nothing is worth advertising. The
 * `"referred"` context shows the referee's side. `products` is advisory: a
 * campaign scoped to none of them ranks below any that matches.
 */
export function selectFormattedReward({
    currency,
    targetInteraction,
    context,
    products,
}: {
    currency?: Currency;
    targetInteraction?: InteractionTypeKey;
    context?: string;
    products?: ProductDetails[];
}) {
    const audience: RewardAudience =
        context === "referred" ? "referee" : "referrer";
    return (rewards: MerchantReward[]): BestReward | undefined =>
        selectBestReward(rewards, {
            currency,
            targetInteraction,
            audience,
            products,
        });
}

/**
 * React-only adapter around `estimatedRewardsQueryOptions`.
 *
 * Lives apart from `estimatedRewardsQueryOptions` so neither `useQuery` nor
 * the `core-sdk/rewards` graph behind `selectFormattedReward` reaches the
 * listener's Ring 0 path, which only calls `queryClient.fetchQuery(...)`.
 */
export function useFormattedEstimatedReward({
    merchantId,
    currency,
    targetInteraction,
    context,
    products,
}: {
    merchantId?: string;
    currency?: Currency;
    targetInteraction?: InteractionTypeKey;
    context?: string;
    /**
     * Advisory product context — see {@link selectFormattedReward}. Must be
     * referentially stable, since a fresh array each render re-runs the
     * `select`.
     */
    products?: ProductDetails[];
}) {
    return useQuery({
        ...estimatedRewardsQueryOptions(merchantId),
        select: selectFormattedReward({
            currency,
            targetInteraction,
            context,
            products,
        }),
    });
}
