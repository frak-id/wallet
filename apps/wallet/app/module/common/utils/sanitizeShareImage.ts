const MAX_LENGTH = 512;

/**
 * Sanitize a share preview image URL: https only, no embedded credentials,
 * query string kept — CDN image URLs are signed. Unlike `sanitizeRedirectUrl`,
 * which strips the query to prevent open redirects, this value is never
 * navigated to.
 */
export function sanitizeShareImage(value: unknown): string | undefined {
    if (typeof value !== "string" || value.length > MAX_LENGTH) {
        return undefined;
    }
    try {
        const url = new URL(value);
        if (url.protocol !== "https:") return undefined;
        if (url.username || url.password) return undefined;
        return url.toString();
    } catch {
        return undefined;
    }
}
