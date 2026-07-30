import type {
    Currency,
    InteractionTypeKey,
    ProductDetails,
} from "@frak-labs/core-sdk";
import { useQuery } from "@tanstack/react-query";
import {
    estimatedRewardsQueryOptions,
    selectFormattedReward,
} from "./useEstimatedReward";

/**
 * React-only adapter around `estimatedRewardsQueryOptions`.
 *
 * Lives in its own file so the React-Query bindings (`useQuery`) never
 * cross into the Ring 0 path — the listener iframe bootstrap consumes
 * `estimatedRewardsQueryOptions` directly via the vanilla
 * `queryClient.fetchQuery(...)`.
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
     * Advisory product context — see {@link selectFormattedReward}. Callers
     * must pass a referentially stable array (memoised on whatever derives
     * it), since a fresh array each render re-runs the `select`.
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
