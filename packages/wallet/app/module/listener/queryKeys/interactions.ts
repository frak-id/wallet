import type { FullInteractionTypesKey } from "@frak-labs/core-sdk";
import type { Hex } from "viem";

const base = {
    interactions: ["interactions"] as const,
} as const;

/**
 * Query keys for listener-related interactions queries
 */
export const listenerInteractionsQueryKeys = {
    base: base.interactions,
    estimatedReward: {
        base: [...base.interactions, "estimated-reward"] as const,
        byProduct: (productId?: Hex, interaction?: FullInteractionTypesKey) =>
            [
                ...base.interactions,
                "estimated-reward",
                productId ?? "no-product-id",
                interaction ?? "no-key-filter",
            ] as const,
    },
} as const;
