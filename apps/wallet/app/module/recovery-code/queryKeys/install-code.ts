/**
 * Query keys for install code related queries and mutations
 */
export namespace installCodeKey {
    const base = "install-code" as const;

    /**
     * Query key for generating a code
     */
    export const generate = (merchantId?: string, anonymousId?: string) =>
        [
            base,
            "generate",
            merchantId ?? "none",
            anonymousId ?? "none",
        ] as const;

    /**
     * Mutation keys
     */
    export const resolve = [base, "resolve"] as const;
    export const consume = [base, "consume"] as const;
}
