/**
 * Query keys for notification-related queries
 */
export namespace notificationKey {
    /**
     * The base key
     */
    const base = "notification" as const;

    /**
     * Query keys for history
     */
    const historyBase = "history" as const;
    export const history = {
        baseKey: [base, historyBase] as const,
    };

    /**
     * Query keys for push
     */
    const pushBase = "push" as const;
    export const push = {
        /**
         * Query keys
         */
        tokenCount: [base, pushBase, "token-count"] as const,

        /**
         * Mutation keys
         */
        subscribe: [base, pushBase, "subscribe"] as const,
        unsubscribe: [base, pushBase, "unsubscribe"] as const,
    };
}
