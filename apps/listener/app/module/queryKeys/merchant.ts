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

    const estimatedRewardsBase = "estimatedRewards" as const;
    export const estimatedRewards = {
        byMerchant: (merchantId?: string) =>
            [
                base,
                estimatedRewardsBase,
                merchantId ?? "no-merchant-id",
            ] as const,
    };

    const referralStatusBase = "referralStatus" as const;
    export const referralStatus = {
        byMerchant: (merchantId?: string) =>
            [base, referralStatusBase, merchantId ?? "no-merchant-id"] as const,
    };
}
