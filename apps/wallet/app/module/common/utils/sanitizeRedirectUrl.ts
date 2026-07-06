/**
 * Sanitize a redirect URL to prevent open redirects.
 *
 * Only allows valid `https://` URLs, and strips any hash and query params so
 * the returned value is a bare `origin + pathname`. Returns `undefined` for
 * anything that isn't a parseable https URL (e.g. `javascript:`, relative
 * paths, or malformed input).
 */
export function sanitizeRedirectUrl(value: unknown): string | undefined {
    if (typeof value !== "string") return undefined;
    try {
        const url = new URL(value);
        if (url.protocol !== "https:") return undefined;
        return url.origin + url.pathname;
    } catch {
        return undefined;
    }
}
