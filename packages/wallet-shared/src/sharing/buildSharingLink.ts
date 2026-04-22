import type {
    AttributionDefaults,
    AttributionParams,
} from "@frak-labs/core-sdk";
import { FrakContextManager, mergeAttribution } from "@frak-labs/core-sdk";
import type { Address } from "viem";

/**
 * Build a Frak-contextualised sharing link.
 *
 * Centralises the `FrakContextManager.update` + `mergeAttribution` boilerplate
 * that used to be duplicated across every sharing entry point (wallet sharing
 * page, listener sharing page, listener modal, embedded wallet, explorer).
 *
 * The V2 context requires `merchantId` and a sharer identifier. Callers should
 * pass `wallet` whenever an authenticated session is available — it's the
 * strongest identity signal (WebAuthn-bound, global across merchants, survives
 * localStorage clears). `clientId` serves as the anonymous fallback; when both
 * are present we embed both for best attribution.
 *
 * Returns `null` when `merchantId` / `baseUrl` are missing, or when neither
 * `clientId` nor `wallet` is available — preserves the caller-side "don't
 * render share UI without a link" contract.
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
