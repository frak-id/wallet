import type {
    AttributionDefaults,
    AttributionParams,
} from "@frak-labs/core-sdk";
import { FrakContextManager, mergeAttribution } from "@frak-labs/core-sdk";
import type { Address } from "viem";

/**
 * Build a Frak-contextualised sharing link.
 *
 * The V2 context needs `merchantId` plus a sharer identifier: `wallet` is the
 * strongest (WebAuthn-bound, survives localStorage clears), `clientId` the
 * anonymous fallback, and both are embedded when available. Returns `null`
 * when `merchantId` / `baseUrl` or every sharer identifier is missing.
 */
export function buildSharingLink(opts: {
    clientId: string | undefined;
    merchantId: string | undefined;
    /** Sharer wallet address. Preferred identity when available. */
    wallet?: Address;
    /** Base URL to decorate. Falls back to caller-provided defaults. */
    baseUrl: string | undefined;
    /** Per-call attribution overrides (e.g. SDK `frak_displaySharingPage` params). */
    attribution?: AttributionParams | null;
    /** Merchant-level attribution defaults (backend-resolved config). */
    defaultAttribution?: AttributionDefaults;
    /** Product-level UTM content (highest priority). */
    productUtmContent?: string;
}): string | null {
    const { clientId, merchantId, wallet, baseUrl } = opts;
    if (!(merchantId && baseUrl)) return null;
    if (!(clientId || wallet)) return null;

    const resolvedAttribution = mergeAttribution({
        perCall: opts.attribution,
        defaults: opts.defaultAttribution,
        productUtmContent: opts.productUtmContent,
    });

    return FrakContextManager.update({
        url: baseUrl,
        context: {
            v: 2,
            m: merchantId,
            t: Math.floor(Date.now() / 1000),
            ...(clientId ? { c: clientId } : {}),
            ...(wallet ? { w: wallet } : {}),
        },
        attribution: resolvedAttribution,
    });
}
