import { SHARE_BUDGET } from "./shareBudget";

/**
 * Sanitize a share preview image URL: https only, no embedded credentials, query string kept —
 * CDN image URLs are signed. Unlike `sanitizeRedirectUrl`, which strips the query to prevent open
 * redirects, this value is never navigated to; iOS fetches it, everything else ignores it.
 *
 * Applied to whichever precedence tier wins, not only to the per-call override: a merchant's
 * `logoUrl` arrives as an unvalidated string too.
 */
export function sanitizeShareImage(value: unknown): string | undefined {
    if (typeof value !== "string" || value.length > SHARE_BUDGET.image) {
        return undefined;
    }
    try {
        const url = new URL(value);
        if (url.protocol !== "https:") return undefined;
        if (url.username || url.password) return undefined;
        const normalized = url.toString();
        // Re-checked after normalization: IDNA and percent-encoding can both grow the string.
        return normalized.length > SHARE_BUDGET.image ? undefined : normalized;
    } catch {
        return undefined;
    }
}
