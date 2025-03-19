const baseMutation = {
    sharing: ["sharing"] as const,
} as const;

/**
 * Mutation keys for listener-related sharing mutations
 */
export const listenerSharingMutationKeys = {
    sharing: {
        base: baseMutation.sharing,
        trigger: (component: string, link: string | null) =>
            [
                component,
                "sharing",
                "system-sharing",
                link ?? "no-link",
            ] as const,
    },
} as const;
