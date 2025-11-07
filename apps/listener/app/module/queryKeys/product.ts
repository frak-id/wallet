import type { Hex } from "viem";

/**
 * Query keys for listener-related product queries
 */
export namespace listenerProductKey {
    /**
     * The base key
     */
    const base = "product" as const;

    /**
     * Query keys for metadata
     */
    const metadataBase = "metadata" as const;
    export const metadata = {
        byId: (productId?: Hex) =>
            [base, metadataBase, productId ?? "no-product-id"] as const,
    };
}
