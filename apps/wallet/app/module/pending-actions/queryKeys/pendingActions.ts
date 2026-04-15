/**
 * Query/mutation keys for pending actions
 */
export namespace pendingActionsKey {
    const base = "pending-actions" as const;

    /**
     * Mutation key for executing pending actions after auth
     */
    export const execute = [base, "execute"] as const;
}
