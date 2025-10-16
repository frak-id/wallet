/**
 * Query keys for listener-related sharing queries
 */
export namespace listenerSharingKey {
    /**
     * The base key
     */
    const base = "sharing" as const;

    /**
     * Query keys for sharing
     */
    export const sharing = {
        trigger: (link: string | null) =>
            [base, "system-sharing", link ?? "no-link"] as const,
    };
}
