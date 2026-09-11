export namespace pendingActionsKey {
    const base = "pending-actions" as const;

    export const execute = [base, "execute"] as const;
}
