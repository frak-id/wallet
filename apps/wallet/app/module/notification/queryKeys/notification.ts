export namespace notificationKey {
    const base = "notification" as const;

    const historyBase = "history" as const;
    export const history = {
        baseKey: [base, historyBase] as const,
    };

    const pushBase = "push" as const;
    export const push = {
        localState: [base, pushBase, "local-state"] as const,
        backendToken: [base, pushBase, "backend-token"] as const,
        subscribe: [base, pushBase, "subscribe"] as const,
        unsubscribe: [base, pushBase, "unsubscribe"] as const,
    };
}
