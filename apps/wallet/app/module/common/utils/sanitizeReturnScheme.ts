/**
 * Strict shape for a native host's return scheme.
 *
 * The page navigates to `<scheme>://result?...` to hand outcomes back to a
 * native host, so an unvalidated value turns a trusted wallet-origin page into
 * an arbitrary scheme launcher (`?returnScheme=some-banking-app`).
 */
const RETURN_SCHEME_PATTERN = /^frak-[a-z0-9._-]{1,60}$/;

/**
 * Validate a return scheme supplied by a native host.
 *
 * Returns the scheme unchanged when it matches the allowed shape, `undefined`
 * otherwise. The value is a bare scheme name, not a URL: callers build the
 * `<scheme>://result` target themselves.
 */
export function sanitizeReturnScheme(value: unknown): string | undefined {
    if (typeof value !== "string") return undefined;
    return RETURN_SCHEME_PATTERN.test(value) ? value : undefined;
}
