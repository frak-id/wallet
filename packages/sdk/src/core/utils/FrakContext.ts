import { type Address, bytesToHex, hexToBytes } from "viem";
import type { FrakContext } from "../../react/types/FrakContext";

/**
 * The context key
 */
const contextKey = "fCtx";

/**
 * Compress the current Frak context
 * @param context
 */
function compress(context?: Partial<FrakContext>): string | undefined {
    if (!context?.r) return;
    try {
        const bytes = hexToBytes(context.r);
        return Buffer.from(bytes).toString("base64url");
    } catch (e) {
        console.error("Error compressing Frak context", { e, context });
    }
    return undefined;
}

/**
 * Decompress the given Frak context
 * @param context
 */
function decompress(context?: string): FrakContext | undefined {
    if (!context || context.length === 0) return;
    try {
        const bytes = Buffer.from(context, "base64url");
        return { r: bytesToHex(bytes, { size: 20 }) as Address };
    } catch (e) {
        console.error("Error decompressing Frak context", { e, context });
    }
    return undefined;
}

/**
 * Parse the current Frak context in the given url
 * @param url
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
    if (!mergedContext.r) return;

    // Compress it
    const compressedContext = compress(mergedContext);
    if (!compressedContext) return;

    // Build the new url and return it
    const urlObj = new URL(url);
    urlObj.searchParams.set(contextKey, compressedContext);
    return urlObj.toString();
}

/**
 * Remove Nexus context from current url
 */
function remove(url: string) {
    const urlObj = new URL(url);
    urlObj.searchParams.delete(contextKey);
    return urlObj.toString();
}

/**
 * Replace the current url with the given Nexus context
 * @param url
 * @param context
 */
function replaceUrl({
    url,
    context,
}: { url?: string; context: Partial<FrakContext> }) {
    // If no window here early exit
    if (!window.location?.href || typeof window === "undefined") {
        console.error("No window found, can't update context");
        return;
    }

    // Get our new url with the frak context
    const newUrl = update({
        url,
        context,
    });

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
