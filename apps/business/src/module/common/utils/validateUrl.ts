const urlRegex =
    /^(https?:\/\/)?(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)*(\.[a-z]{2,})+\/?$/i;

export function validateUrl(url: string): boolean {
    return urlRegex.test(url);
}

/** Prepend `https://` when the user omits a scheme; leave empty untouched. */
export function normalizeUrl(value: string): string {
    const trimmed = value.trim();
    if (trimmed === "") return "";
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/**
 * Empty is allowed (optional field); otherwise the normalized value must be a
 * valid http(s) URL within the backend's 2048 char limit.
 */
export function isValidUrl(value: string): boolean {
    const normalized = normalizeUrl(value);
    if (normalized === "") return true;
    if (normalized.length > 2048) return false;
    try {
        const url = new URL(normalized);
        return url.protocol === "https:" || url.protocol === "http:";
    } catch {
        return false;
    }
}
