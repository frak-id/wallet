/**
 * Query keys for install code related queries and mutations
 */
export namespace installCodeKey {
    const base = "install-code" as const;

    /**
     * Query key for generating a code
     */
    export const generate = (
        merchantId?: string,
        anonymousId?: string,
        pairingId?: string
    ) =>
        [
            base,
            "generate",
            merchantId ?? "none",
            anonymousId ?? "none",
            pairingId ?? "none",
        ] as const;

    /**
     * Mutation keys
     */
    export const resolve = [base, "resolve"] as const;
}
