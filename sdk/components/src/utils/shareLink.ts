import type {
    InteractionTypeKey,
    SharingPageProduct,
} from "@frak-labs/core-sdk";
import { compressJsonToB64, decompressJsonFromB64 } from "@frak-labs/core-sdk";

/** URL query key carrying the auto-action name. */
export const FRAK_ACTION_KEY = "frakAction";

/** URL query key carrying the compressed payload for the auto-action. */
export const FRAK_DATA_KEY = "frakData";

/**
 * Payload encoded into the `frakData` query param that customizes the
 * sharing modal opened by a `?frakAction=share` URL.
 *
 * Mirrors the subset of `OpenSharingPageOptions` that makes sense to ship
 * over a URL — `placement` is intentionally excluded (placements are bound
 * to merchant-rendered elements, not external links).
 *
 * @group Share Link
 */
export type ShareLinkPayload = {
    /**
     * Override the link the sharing modal generates. Defaults to the
     * current page URL when omitted.
     */
    link?: string;
    /** Products to showcase in the sharing modal. */
    products?: SharingPageProduct[];
    /** Target interaction associated with the share event. */
    targetInteraction?: InteractionTypeKey;
};

/**
 * Mint a URL that, when opened on a Frak-enabled storefront, triggers the
 * sharing modal pre-filled with the supplied payload.
 *
 * Useful for newsletters, post-purchase emails, social posts, in-app
 * banners, and any offsite link that should land the visitor inside a
 * specific share flow.
 *
 * @example
 * ```ts
 * const url = buildShareLinkUrl({
 *     baseUrl: "https://acme.com",
 *     payload: {
 *         link: "https://acme.com/product/red-shirt",
 *         products: [{ title: "Red shirt", imageUrl: "https://acme.com/r.png" }],
 *     },
 * });
 * // → "https://acme.com/?frakAction=share&frakData=eJyrVi..."
 * ```
 *
 * @param args
 * @param args.baseUrl - Destination storefront URL.
 * @param args.payload - Optional sharing context. When omitted (or empty)
 *   only `?frakAction=share` is appended; the modal falls back to the
 *   merchant's defaults.
 */
export function buildShareLinkUrl({
    baseUrl,
    payload,
}: {
    baseUrl: string;
    payload?: ShareLinkPayload;
}): string {
    const url = new URL(baseUrl);
    url.searchParams.set(FRAK_ACTION_KEY, "share");

    if (payload && hasContent(payload)) {
        url.searchParams.set(FRAK_DATA_KEY, compressJsonToB64(payload));
    } else {
        // Strip stale data if the caller reuses an existing URL.
        url.searchParams.delete(FRAK_DATA_KEY);
    }

    return url.toString();
}

/**
 * Decode the `frakData` payload from a URL search string.
 *
 * @param searchString - URL query string (e.g. `window.location.search`).
 *   When omitted, defaults to `window.location.search` if available.
 * @returns The decoded payload, or `null` when absent or malformed.
 */
export function parseShareLinkPayload(
    searchString?: string
): ShareLinkPayload | null {
    const search =
        searchString ??
        (typeof window !== "undefined" ? window.location?.search : undefined);
    if (!search) return null;

    const params = new URLSearchParams(search);
    const dataParam = params.get(FRAK_DATA_KEY);
    if (!dataParam) return null;

    try {
        return decompressJsonFromB64<ShareLinkPayload>(dataParam);
    } catch (e) {
        console.warn("[Frak SDK] Failed to decode frakData", e);
        return null;
    }
}

/**
 * True when the payload has at least one non-empty field worth encoding.
 * Empty arrays / undefined values are treated as "no content" so we don't
 * waste URL space on `frakData=eyJ9` (an empty object payload).
 */
function hasContent(payload: ShareLinkPayload): boolean {
    if (payload.link) return true;
    if (payload.targetInteraction) return true;
    if (payload.products && payload.products.length > 0) return true;
    return false;
}
