/**
 * Extract the registrable host from a URL or origin, stripping a leading
 * `www.` prefix.
 *
 * The `www.` strip is anchored on purpose: an unanchored `replace("www.", "")`
 * also rewrites `foo.www.example.com` into `foo.example.com`, which silently
 * widens any allow-list comparison built on top of it.
 *
 * Returns `null` when the input is not a parseable URL so callers degrade
 * explicitly rather than inheriting a fallback they did not choose:
 * - security-sensitive callers (origin allow-listing, backup restore) MUST
 *   fail closed on `null`;
 * - display/lookup callers may fall back to the raw input.
 */
export function extractDomain(input: string): string | null {
    try {
        return new URL(input).host.replace(/^www\./, "");
    } catch {
        return null;
    }
}
