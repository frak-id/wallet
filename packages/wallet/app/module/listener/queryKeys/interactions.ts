import type { FullInteractionTypesKey } from "@frak-labs/core-sdk";
import type { Hex } from "viem";

/**
 * Query keys for listener-related interactions queries
 */
export namespace listenerInteractionsKey {
    /**
     * The base key
     */
    const base = "interactions" as const;

    /**
     * Query keys for estimated reward
     */
    const estimatedRewardBase = "estimated-reward" as const;
    export const estimatedReward = {
        byProduct: (productId?: Hex, interaction?: FullInteractionTypesKey) =>
            [
                base,
                estimatedRewardBase,
                productId ?? "no-product-id",
                interaction ?? "no-key-filter",
            ] as const,
    };
}
