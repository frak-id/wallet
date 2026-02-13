/**
 * Query keys for listener-related identity queries
 */
export namespace listenerIdentityKey {
    const base = "identity" as const;

    const mergeBase = "merge" as const;
    export const merge = {
        token: (clientId?: string, merchantId?: string) =>
            [
                base,
                mergeBase,
                "token",
                clientId ?? "no-client-id",
                merchantId ?? "no-merchant-id",
            ] as const,
    };
}
