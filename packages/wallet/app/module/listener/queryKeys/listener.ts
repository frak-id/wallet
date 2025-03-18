import type { FullInteractionTypesKey } from "@frak-labs/core-sdk";
import type { Hex } from "viem";

/**
 * Query keys for listener-related queries
 */
const base = {
    product: ["product"] as const,
    interactions: ["interactions"] as const,
} as const;

export const listenerQueryKeys = {
    product: {
        base: base.product,
        metadata: {
            base: [...base.product, "get-metadata"] as const,
            byId: (productId?: Hex) =>
                [
                    ...base.product,
                    "get-metadata",
                    productId ?? "no-product-id",
                ] as const,
        },
    },
    interactions: {
        base: base.interactions,
        estimatedReward: {
            base: [...base.interactions, "estimated-reward"] as const,
            byProduct: (
                productId?: Hex,
                interaction?: FullInteractionTypesKey
            ) =>
                [
                    ...base.interactions,
                    "estimated-reward",
                    productId ?? "no-product-id",
                    interaction ?? "no-key-filter",
                ] as const,
        },
    },
} as const;
