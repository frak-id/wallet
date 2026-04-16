import { type Address, bytesToHex, hexToBytes, isAddress } from "viem";
import type {
    AttributionParams,
    FrakContext,
    FrakContextV1,
    FrakContextV2,
} from "../types";
import { isV2Context } from "../types";
import { base64urlDecode, base64urlEncode } from "./compression/b64";
import { compressJsonToB64 } from "./compression/compress";
import { decompressJsonFromB64 } from "./compression/decompress";

/**
 * URL parameter key for the Frak referral context
 */
const contextKey = "fCtx";

/**
 * Compress a Frak context into a URL-safe string.
 *
 * - V2 contexts are serialized as compressed JSON (base64url).
 * - V1 contexts encode the wallet address as raw bytes (base64url).
 *
 * @param context - The context to compress (V1 or V2)
 * @returns A compressed base64url string, or undefined on failure
 */
function compress(context?: FrakContextV1 | FrakContextV2): string | undefined {
    if (!context) return;
    try {
        if (isV2Context(context)) {
            // Runtime validation: all V2 fields must be present and truthy
            if (!context.c || !context.m || !context.t) return undefined;
            return compressJsonToB64({
                v: 2,
                c: context.c,
                m: context.m,
                t: context.t,
            });
        }

        // V1 legacy: compress wallet address as raw bytes
        const bytes = hexToBytes(context.r);
        return base64urlEncode(bytes);
    } catch (e) {
        console.error("Error compressing Frak context", { e, context });
    }
    return undefined;
}

/**
 * Decompress a base64url string back into a Frak context.
 *
 * Attempts V2 JSON decompression first, then falls back to V1 raw bytes.
 *
 * @param context - The compressed context string
 * @returns The decompressed FrakContext, or undefined on failure
 */
function decompress(context?: string): FrakContext | undefined {
    if (!context || context.length === 0) return;
    try {
        // Try V2 JSON first — V2 payloads are longer than V1's 20-byte address
        const json = decompressJsonFromB64<FrakContextV2>(context);
        if (json && typeof json === "object" && json.v === 2) {
            if (json.c && json.m && json.t) {
                return { v: 2, c: json.c, m: json.m, t: json.t };
            }
            return undefined;
        }

        // Fall back to V1: raw 20-byte address
        const bytes = base64urlDecode(context);
        const hex = bytesToHex(bytes, { size: 20 }) as Address;
        if (isAddress(hex)) {
            return { r: hex };
        }
    } catch (e) {
        console.error("Error decompressing Frak context", { e, context });
    }
    return undefined;
}

/**
 * Parse a URL to extract the Frak referral context from the `fCtx` query parameter.
 *
 * @param args
 * @param args.url - The URL to parse
 * @returns The parsed FrakContext, or null if absent
 */
function parse({ url }: { url: string }): FrakContext | null | undefined {
    if (!url) return null;

    const urlObj = new URL(url);
    const frakContext = urlObj.searchParams.get(contextKey);
    if (!frakContext) return null;

    return decompress(frakContext);
}

/**
 * Default UTM medium value when attribution is requested.
 */
const DEFAULT_UTM_MEDIUM = "referral";

/**
 * Default utm_source / via value when attribution is requested.
 */
const DEFAULT_ATTRIBUTION_SOURCE = "frak";

/**
 * Resolve attribution defaults from the provided context.
 *
 * V2 contexts expose the merchantId (`m`) and clientId (`c`), which feed
 * `utm_campaign` and `ref` respectively. V1 contexts have no equivalent, so
 * only the static defaults (`utm_source`, `utm_medium`, `via`) apply.
 */
function resolveAttributionValues(
    context: FrakContextV1 | FrakContextV2,
    overrides: AttributionParams
): Record<string, string | undefined> {
    const isV2 = isV2Context(context);
    return {
        utm_source: overrides.utmSource ?? DEFAULT_ATTRIBUTION_SOURCE,
        utm_medium: overrides.utmMedium ?? DEFAULT_UTM_MEDIUM,
        utm_campaign: overrides.utmCampaign ?? (isV2 ? context.m : undefined),
        utm_content: overrides.utmContent,
        utm_term: overrides.utmTerm,
        via: overrides.via ?? DEFAULT_ATTRIBUTION_SOURCE,
        ref: overrides.ref ?? (isV2 ? context.c : undefined),
    };
}

/**
 * Append attribution query params to a URL using gap-fill semantics.
 *
 * Existing params on the URL are preserved untouched (so merchant-provided
 * UTMs take precedence). Only missing keys are populated.
 */
function applyAttributionParams(
    urlObj: URL,
    context: FrakContextV1 | FrakContextV2,
    attribution?: AttributionParams
): void {
    const values = resolveAttributionValues(context, attribution ?? {});
    for (const [key, value] of Object.entries(values)) {
        if (value === undefined || value === "") continue;
        if (urlObj.searchParams.has(key)) continue;
        urlObj.searchParams.set(key, value);
    }
}

/**
 * Add or replace the `fCtx` query parameter in a URL with the given context.
 *
 * When `attribution` is provided (even as an empty object), standard affiliation
 * params (`utm_source`, `utm_medium`, `utm_campaign`, `ref`, `via`, ...) are
 * also appended using gap-fill semantics: pre-existing params on the URL are
 * preserved, and defaults are derived from the context when applicable.
 *
 * @param args
 * @param args.url - The URL to update
 * @param args.context - The context to embed (V1 or V2)
 * @param args.attribution - Optional attribution overrides. Omit to skip UTM/ref params.
 * @returns The updated URL string, or null on failure
 */
function update({
    url,
    context,
    attribution,
}: {
    url?: string;
    context: FrakContextV1 | FrakContextV2;
    attribution?: AttributionParams;
}): string | null {
    if (!url) return null;

    const compressedContext = compress(context);
    if (!compressedContext) return null;

    const urlObj = new URL(url);
    urlObj.searchParams.set(contextKey, compressedContext);
    applyAttributionParams(urlObj, context, attribution);
    return urlObj.toString();
}

/**
 * Remove the `fCtx` query parameter from a URL.
 *
 * @param url - The URL to strip the context from
 * @returns The cleaned URL string
 */
function remove(url: string): string {
    const urlObj = new URL(url);
    urlObj.searchParams.delete(contextKey);
    return urlObj.toString();
}

/**
 * Replace the current browser URL with an updated Frak context.
 *
 * - If `context` is non-null, embeds it via {@link update}.
 * - If `context` is null, strips the context via {@link remove}.
 *
 * @param args
 * @param args.url - Base URL (defaults to `window.location.href`)
 * @param args.context - Context to set, or null to remove
 */
function replaceUrl({
    url: baseUrl,
    context,
}: {
    url?: string;
    context: FrakContextV1 | FrakContextV2 | null;
}) {
    if (!window.location?.href || typeof window === "undefined") {
        console.error("No window found, can't update context");
        return;
    }

    const url = baseUrl ?? window.location.href;

    let newUrl: string | null;
    if (context !== null) {
        newUrl = update({ url, context });
    } else {
        newUrl = remove(url);
    }

    if (!newUrl) return;

    window.history.replaceState(null, "", newUrl.toString());
}

/**
 * Manager for Frak referral context in URLs.
 *
 * Handles compression, decompression, URL parsing, and browser history updates
 * for both V1 (wallet address) and V2 (anonymous clientId) referral contexts.
 */
export const FrakContextManager = {
    compress,
    decompress,
    parse,
    update,
    remove,
    replaceUrl,
};
