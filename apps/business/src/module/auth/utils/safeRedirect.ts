const DEFAULT_TARGET = "/dashboard";

/**
 * Sanitize the URL-controlled `redirect` search param before navigating to it
 * (plan §2.5). Only same-origin, relative paths are allowed — an absolute or
 * protocol-relative URL (`https://evil.com`, `//evil.com`) or a backslash
 * trick would be an open-redirect, so anything that isn't a plain `/path`
 * falls back to the dashboard.
 */
export function safeRedirectTarget(
    redirect: string | undefined | null
): string {
    if (!redirect) return DEFAULT_TARGET;
    // Must be a single-slash absolute path; reject protocol-relative `//host`
    // and backslash variants browsers may normalize to `//`.
    if (!redirect.startsWith("/")) return DEFAULT_TARGET;
    if (redirect.startsWith("//") || redirect.startsWith("/\\")) {
        return DEFAULT_TARGET;
    }
    if (redirect.includes("\\")) return DEFAULT_TARGET;
    return redirect;
}
