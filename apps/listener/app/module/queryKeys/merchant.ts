/**
 * Query keys for listener-related merchant queries
 */
export namespace listenerMerchantKey {
    const base = "merchant" as const;

    const metadataBase = "metadata" as const;
    export const metadata = {
        byId: (merchantId?: string) =>
            [base, metadataBase, merchantId ?? "no-merchant-id"] as const,
    };
}
