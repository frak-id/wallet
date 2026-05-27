/**
 * Query keys for merchant-resolution queries (config, info, estimated rewards).
 */
export namespace merchantKey {
    const base = "merchant" as const;

    /**
     * Backend-resolved merchant config (`sdkConfig`, attribution defaults,
     * branding). Cached per `(merchantId, lang)`.
     */
    export const resolvedConfig = (merchantId?: string, lang?: string) =>
        [
            base,
            "resolvedConfig",
            merchantId ?? "no-merchant-id",
            lang ?? "no-lang",
        ] as const;

    /**
     * Lightweight merchant info (name, domain). Cached per `merchantId`.
     */
    export const info = (merchantId?: string) =>
        [base, "info", merchantId ?? "none"] as const;

    /**
     * Estimated reward payouts for a merchant's campaigns. Cached per
     * `merchantId`.
     */
    export const estimatedRewards = (merchantId?: string) =>
        [base, "estimatedRewards", merchantId ?? "no-merchant-id"] as const;
}
