import type { FrakContext } from "../../react/types/FrakContext";
import { compressJson, decompressJson } from "./compression";

/**
 * The context key
 */
const contextKey = "fCtx";

/**
 * Parse the current Nexus context in the given url
 * @param url
 */
async function parse({ url }: { url: string }) {
    if (!url) return null;

    // Check if the url contain the nexus context key
    const urlObj = new URL(url);
    const nexusContext = urlObj.searchParams.get(contextKey);
    if (!nexusContext) return null;

    // Parse the nexus context
    const parsedContext = await decompressJson<FrakContext>(decodeURIComponent(nexusContext));
    if (!parsedContext) return null;

    // Return the parsed context
    return parsedContext;
}

/**
 * Populate the current url with the given Nexus context
 */
async function update({
    url,
    context,
}: { url?: string; context: Partial<FrakContext> }) {
    if (!url) return null;

    // Parse the current context
    const currentContext = await parse({ url });

    // Merge the current context with the new context
    const mergedContext = currentContext
        ? { ...currentContext, ...context }
        : context;

    // Compress the updated context
    const compressedContext = await compressJson(mergedContext);
    if (!compressedContext) return;

    // Build the new url
    const urlObj = new URL(url);
    urlObj.searchParams.set(contextKey, encodeURIComponent(compressedContext));

    // And return it
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
async function replaceUrl({
    url,
    context,
}: { url?: string; context: Partial<FrakContext> }) {
    // If no window here early exit
    if (!window.location?.href || typeof window === "undefined") {
        console.error("No window found, can't update context");
        return;
    }

    // Get our new url with the nexus context
    const newUrl = await update({
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
    parse,
    update,
    remove,
    replaceUrl,
};
