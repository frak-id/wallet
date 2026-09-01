import { isPublicHost } from "./isPublicHost";
import { SHARE_BUDGET } from "./shareBudget";

/** https-only image URL, credentials rejected, query kept — CDN image URLs are signed. */
export function sanitizeShareImage(value: unknown): string | undefined {
    if (typeof value !== "string" || value.length > SHARE_BUDGET.image) {
        return undefined;
    }
    try {
        const url = new URL(value);
        if (url.protocol !== "https:") return undefined;
        if (url.username || url.password) return undefined;
        // The Tauri host fetches this, so a private target would probe the user's own network.
        if (!isPublicHost(url.hostname)) return undefined;
        const normalized = url.toString();
        // Re-checked after normalization: IDNA and percent-encoding can both grow the string.
        return normalized.length > SHARE_BUDGET.image ? undefined : normalized;
    } catch {
        return undefined;
    }
}
