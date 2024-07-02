/**
 * Fix the link for the current domain
 * @param link
 */
export function fixLink(link: string) {
    // Get the current origin
    const hostname =
        typeof window !== "undefined" && window.location.hostname
            ? window.location.hostname
            : undefined;

    if (!hostname) {
        return link;
    }

    // Get the base link
    const baseLink = new URL(link);
    // Replace the origin with the current link
    baseLink.hostname = hostname;

    return baseLink.toString();
}
