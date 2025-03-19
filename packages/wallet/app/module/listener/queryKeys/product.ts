import type { Hex } from "viem";

const base = {
    product: ["product"] as const,
} as const;

/**
 * Query keys for listener-related product queries
 */
export const listenerProductQueryKeys = {
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
} as const;
