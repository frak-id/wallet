export namespace notificationKey {
    const base = "notification" as const;

    const historyBase = "history" as const;
    export const history = {
        baseKey: [base, historyBase] as const,
    };

    const pushBase = "push" as const;
    export const push = {
        permission: [base, pushBase, "permission"] as const,
        localToken: [base, pushBase, "local-token"] as const,
        backendToken: [base, pushBase, "backend-token"] as const,
        subscribe: [base, pushBase, "subscribe"] as const,
        unsubscribe: [base, pushBase, "unsubscribe"] as const,
    };
}
