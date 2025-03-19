const base = {
    notification: ["notification"] as const,
};

/**
 * Query keys for notification-related queries
 */
export const notificationQueryKeys = {
    base: base.notification,
    history: {
        base: [...base.notification, "history"] as const,
    },
    push: {
        base: [...base.notification, "push"] as const,
        tokenCount: [...base.notification, "push", "token-count"] as const,
    },
} as const;

/**
 * Mutation keys for notification-related mutations
 */
export const notificationMutationKeys = {
    push: {
        base: [...base.notification, "push"] as const,
        subscribe: [...base.notification, "push", "subscribe"] as const,
        unsubscribe: [...base.notification, "push", "unsubscribe"] as const,
    },
} as const;
