import type {
    AttributionDefaults,
    AttributionParams,
} from "@frak-labs/core-sdk";
import { FrakContextManager, mergeAttribution } from "@frak-labs/core-sdk";

/**
 * Build a Frak-contextualised sharing link.
 *
 * Centralises the `FrakContextManager.update` + `mergeAttribution` boilerplate
 * that used to be duplicated across every sharing entry point (wallet sharing
 * page, listener sharing page, listener modal, embedded wallet, explorer).
 *
 * Returns `null` when `clientId` or `merchantId` is missing — preserves the
 * caller-side "don't render share UI without a link" contract.
 */
export function buildSharingLink(opts: {
    clientId: string | undefined;
    merchantId: string | undefined;
    /** Base URL to decorate. Falls back to caller-provided defaults. */
    baseUrl: string | undefined;
    /** Per-call attribution overrides (e.g. SDK `frak_displaySharingPage` params). */
    attribution?: AttributionParams | null;
    /** Merchant-level attribution defaults (backend-resolved config). */
    defaultAttribution?: AttributionDefaults;
    /** Product-level UTM content (highest priority). */
    productUtmContent?: string;
}): string | null {
    const { clientId, merchantId, baseUrl } = opts;
    if (!(clientId && merchantId && baseUrl)) return null;

    const resolvedAttribution = mergeAttribution({
        perCall: opts.attribution,
        defaults: opts.defaultAttribution,
        productUtmContent: opts.productUtmContent,
    });

    return FrakContextManager.update({
        url: baseUrl,
        context: {
            v: 2,
            c: clientId,
            m: merchantId,
            t: Math.floor(Date.now() / 1000),
        },
        attribution: resolvedAttribution,
    });
}
