import { type Address, bytesToHex, hexToBytes } from "viem";
import type { FrakContext } from "../types";

/**
 * The context key
 */
const contextKey = "fCtx";

function base64url_encode(buffer: Uint8Array): string {
    return btoa(Array.from(buffer, (b) => String.fromCharCode(b)).join(""))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}

function base64url_decode(value: string): Uint8Array {
    const m = value.length % 4;
    return Uint8Array.from(
        atob(
            value
                .replace(/-/g, "+")
                .replace(/_/g, "/")
                .padEnd(value.length + (m === 0 ? 0 : 4 - m), "=")
        ),
        (c) => c.charCodeAt(0)
    );
}

/**
 * Compress the current Frak context
 * @param context - The context to be compressed
 * @returns A compressed string containing the Frak context
 */
function compress(context?: Partial<FrakContext>): string | undefined {
    if (!context?.r) return;
    try {
        const bytes = hexToBytes(context.r);
        return base64url_encode(bytes);
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
        const bytes = base64url_decode(context);
        return { r: bytesToHex(bytes, { size: 20 }) as Address };
    } catch (e) {
        console.error("Error decompressing Frak context", { e, context });
    }
    return undefined;
}

/**
 * Parse the current URL into a Frak Context
 * @param options
 * @param options.url - The url to parse
 * @returns The parsed Frak context
 */
function parse({ url }: { url: string }) {
    if (!url) return null;

    // Check if the url contain the frak context key
    const urlObj = new URL(url);
    const frakContext = urlObj.searchParams.get(contextKey);
    if (!frakContext) return null;

    // Decompress and return it
    return decompress(frakContext);
}

/**
 * Populate the current url with the given Frak context
 * @param options
 * @param options.url - The url to update
 * @param options.context - The context to update
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
 * @param options
 * @param options.url - The url to update
 * @param options.context - The context to update
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
 * Export our frak context "class"
 */
export const FrakContextManager = {
    compress,
    decompress,
    parse,
    update,
    remove,
    replaceUrl,
};
