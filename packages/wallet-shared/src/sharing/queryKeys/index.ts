import type { SharingSource } from "../../common/analytics/events";

/**
 * Query / mutation keys for sharing-related flows.
 */
export namespace sharingKey {
    const base = "sharing" as const;

    /**
     * Mutation: invoke the native (or Web Share API) share sheet. Cached
     * per `(source, link)` so concurrent invocations from different
     * entry points don't collide.
     */
    export const trigger = (source: SharingSource, link?: string | null) =>
        [base, "trigger", source, link ?? "no-link"] as const;

    /**
     * Sharing-route order-client query: resolves the post-share order
     * tracking client for a given checkout token.
     */
    export const orderClient = (
        merchantId?: string,
        checkoutToken?: string | null
    ) =>
        [
            base,
            "order-client",
            merchantId ?? "no-merchant",
            checkoutToken ?? "no-token",
        ] as const;
}
