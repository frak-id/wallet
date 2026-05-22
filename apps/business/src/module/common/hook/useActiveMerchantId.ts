import { useParams } from "@tanstack/react-router";

/**
 * Reads the active merchant id from the `/m/$merchantId/...` route segment.
 *
 * The `_restricted/m/$merchantId` layout validates the id and redirects
 * away when it isn't accessible, so any component rendered underneath
 * can safely assume the id is present and authorised.
 */
export function useActiveMerchantId(): string {
    const { merchantId } = useParams({ from: "/_restricted/m/$merchantId" });
    return merchantId;
}

/**
 * Variant that returns `undefined` outside of a `/m/$merchantId/` route —
 * use when a component might also render at the root (e.g. shared header).
 *
 * The cast is intentional: `useParams({ strict: false })` returns a union
 * of every matched route's params, which collapses to `unknown` in the
 * type system. The shared shape we care about is `{ merchantId?: string }`
 * — every route that has a merchantId names it the same way.
 */
export function useOptionalActiveMerchantId(): string | undefined {
    const params = useParams({ strict: false }) as {
        merchantId?: string;
    };
    return params.merchantId;
}
