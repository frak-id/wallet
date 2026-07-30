const urlRegex =
    /^(https?:\/\/)?(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)*(\.[a-z]{2,})+\/?$/i;

/**
 * Whether `value` is safe to bind to an `href` / `src`: a valid URL with an
 * `http(s):` scheme. Guards merchant-authored URLs at render time, since rows
 * written before the backend's schema validation are still in the database.
 *
 * Unlike {@link isValidUrl} this does not normalize and rejects scheme-less
 * hosts — it answers "can I render this exact string". Callers render plain
 * text when it returns false.
 */
export function isRenderableUrl(value: string | undefined | null): boolean {
    if (!value) return false;
    try {
        const { protocol } = new URL(value);
        return protocol === "https:" || protocol === "http:";
    } catch {
        return false;
    }
}

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
    const trimmed = value.trim();
    // Reject an explicit non-http(s) scheme up front: normalizeUrl only skips
    // prepending for an existing http(s):// prefix, so `ftp://x` would become
    // `https://ftp://x` (host `ftp`) and slip past the protocol check below.
    const scheme = trimmed.match(/^([a-z][a-z0-9+.-]*):/i);
    if (scheme && !/^https?$/i.test(scheme[1])) return false;
    const normalized = normalizeUrl(trimmed);
    if (normalized === "") return true;
    if (normalized.length > 2048) return false;
    try {
        const url = new URL(normalized);
        return url.protocol === "https:" || url.protocol === "http:";
    } catch {
        return false;
    }
}
