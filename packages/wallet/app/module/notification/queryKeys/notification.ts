/**
 * Query keys for notification-related queries
 */
const base = {
    notification: ["notification"] as const,
    push: ["push"] as const,
};

export const notificationQueryKeys = {
    base: base.notification,
    history: {
        base: [...base.notification, "history"] as const,
    },
    push: {
        base: [...base.notification, "push"] as const,
        tokenCount: [
            ...base.notification,
            ...base.push,
            "token-count",
        ] as const,
        unsubscribe: [
            ...base.notification,
            ...base.push,
            "unsubscribe",
        ] as const,
    },
} as const;
