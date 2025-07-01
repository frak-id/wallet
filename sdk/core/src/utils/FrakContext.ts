import { type Address, bytesToHex, hexToBytes } from "viem";
import type { FrakContext } from "../types";
import { base64urlDecode, base64urlEncode } from "./compression/b64";

/**
 * The context key
 */
const contextKey = "fCtx";

/**
 * Compress the current Frak context
 * @param context - The context to be compressed
 * @returns A compressed string containing the Frak context
 */
function compress(context?: Partial<FrakContext>): string | undefined {
    if (!context?.r) return;
    try {
        // Create buffer: 20 bytes for referrer + 20 bytes for campaign (if present)
        const hasCampaign = !!context.c;
        const bufferSize = hasCampaign ? 41 : 20; // 20 + 20 + 1 flag byte or just 20
        const buffer = new Uint8Array(bufferSize);

        // Add referrer address
        const referrerBytes = hexToBytes(context.r);
        buffer.set(referrerBytes, 0);

        if (hasCampaign && context.c) {
            // Add flag indicating campaign is present
            buffer[20] = 1;
            // Add campaign address
            const campaignBytes = hexToBytes(context.c);
            buffer.set(campaignBytes, 21);
        }

        return base64urlEncode(buffer);
    } catch (e) {
        console.error("Error compressing Frak context", { e, context });
    }
    return undefined;
}

/**
 * Decompress the given Frak context
 * @param context - The raw context to be decompressed into a `FrakContext`
 * @returns The decompressed Frak context, or undefined if it fails
 */
function decompress(context?: string): FrakContext | undefined {
    if (!context || context.length === 0) return;
    try {
        const bytes = base64urlDecode(context);

        // Extract referrer address (first 20 bytes)
        const referrerBytes = bytes.slice(0, 20);
        const result: FrakContext = {
            r: bytesToHex(referrerBytes, { size: 20 }) as Address,
        };

        // Check if campaign data is present (buffer size > 20 and flag byte is set)
        if (bytes.length > 20 && bytes[20] === 1) {
            const campaignBytes = bytes.slice(21, 41);
            result.c = bytesToHex(campaignBytes, { size: 20 }) as Address;
        }

        return result;
    } catch (e) {
        console.error("Error decompressing Frak context", { e, context });
    }
    return undefined;
}

/**
 * Parse the current URL into a Frak Context
 * @param args
 * @param args.url - The url to parse
 * @returns The parsed Frak context (partial if only campaignId is present)
 */
function parse({
    url,
}: { url: string }): FrakContext | Partial<FrakContext> | null {
    if (!url) return null;

    const urlObj = new URL(url);

    // Check if the url contain the frak context key
    const frakContext = urlObj.searchParams.get(contextKey);
    if (frakContext) {
        // Decompress and return it
        const decompressed = decompress(frakContext);
        return decompressed || null;
    }

    // Also check for direct campaignId parameter
    const campaignId = urlObj.searchParams.get("campaignId");
    if (campaignId) {
        try {
            // Validate that campaignId is a valid address
            const campaignAddress = campaignId as Address;
            // For now, return context with only campaign ID (no referrer)
            // This may need adjustment based on business logic
            return { c: campaignAddress } as Partial<FrakContext>;
        } catch (e) {
            console.error("Invalid campaignId parameter", { e, campaignId });
        }
    }

    return null;
}

/**
 * Populate the current url with the given Frak context
 * @param args
 * @param args.url - The url to update
 * @param args.context - The context to update
 * @returns The new url with the Frak context
 */
function update({
    url,
    context,
}: { url?: string; context: Partial<FrakContext> }) {
    if (!url) return null;

    // Parse the current context
    const currentContext = parse({ url });

    // Merge the current context with the new context
    const mergedContext = currentContext
        ? { ...currentContext, ...context }
        : context;

    // If we don't have a referrer, early exit
    if (!mergedContext.r) return null;

    // Compress it
    const compressedContext = compress(mergedContext);
    if (!compressedContext) return null;

    // Build the new url and return it
    const urlObj = new URL(url);
    urlObj.searchParams.set(contextKey, compressedContext);
    return urlObj.toString();
}

/**
 * Remove Frak context from current url
 * @param url - The url to update
 * @returns The new url without the Frak context
 */
function remove(url: string) {
    const urlObj = new URL(url);
    urlObj.searchParams.delete(contextKey);
    return urlObj.toString();
}

/**
 * Replace the current url with the given Frak context
 * @param args
 * @param args.url - The url to update
 * @param args.context - The context to update
 */
function replaceUrl({
    url: baseUrl,
    context,
}: { url?: string; context: Partial<FrakContext> | null }) {
    // If no window here early exit
    if (!window.location?.href || typeof window === "undefined") {
        console.error("No window found, can't update context");
        return;
    }

    // If no url, try to use the current one
    const url = baseUrl ?? window.location.href;

    // Get our new url with the frak context
    let newUrl: string | null;
    if (context !== null) {
        newUrl = update({
            url,
            context,
        });
    } else {
        newUrl = remove(url);
    }

    // If no new url, early exit
    if (!newUrl) return;

    // Update the url
    window.history.replaceState(null, "", newUrl.toString());
}

/**
 * Extract campaignId from FrakContext or URL parameters
 * @param args
 * @param args.context - The FrakContext to extract from
 * @param args.url - Alternative URL to parse campaignId from
 * @returns The campaign ID if found
 */
function extractCampaignId({
    context,
    url,
}: {
    context?: Partial<FrakContext>;
    url?: string;
}): Address | undefined {
    // First check context
    if (context?.c) {
        return context.c;
    }

    // Then check URL
    if (url) {
        const parsedContext = parse({ url });
        return parsedContext?.c;
    }

    return undefined;
}

/**
 * Export our frak context "class"
 */
export const FrakContextManager = {
    compress,
    decompress,
    parse,
    update,
    remove,
    replaceUrl,
    extractCampaignId,
};
