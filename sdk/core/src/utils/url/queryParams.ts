/**
 * Case-insensitive helpers for reading URL query parameters.
 *
 * Some email tools (Klaviyo, Omnisend, Customer.io …) and a few browsers
 * lowercase the entire URL before the recipient opens it, so a mixed-case key
 * authored as `frakAction` or `fCtx` can arrive as `frakaction` / `fctx`. A
 * plain `searchParams.get("frakAction")` would miss it. Matching the key
 * ignoring case keeps UI-triggering and referral params working regardless of
 * how the link was mangled in transit.
 *
 * Note: only the key is normalised. An encoded value (base64url, tokens) is not
 * recoverable if the same channel also lowercased the value itself.
 */

/**
 * Read a query parameter, matching its key case-insensitively.
 *
 * An exact-case match wins when present, so a canonical link is never shadowed
 * by a mangled duplicate (`?fctx=stale&fCtx=real` resolves to `real`). Only when
 * the exact key is absent do we scan for a case-folded variant.
 *
 * @returns the param value, or `null` when no key matches.
 */
export function getQueryParamCaseInsensitive(
    searchParams: URLSearchParams,
    key: string
): string | null {
    const exact = searchParams.get(key);
    if (exact !== null) return exact;

    const target = key.toLowerCase();
    for (const [paramKey, value] of searchParams) {
        if (paramKey.toLowerCase() === target) {
            return value;
        }
    }
    return null;
}

/**
 * Delete every query parameter whose key matches `key` case-insensitively.
 *
 * Keys are collected before deletion because mutating a `URLSearchParams`
 * while iterating it skips entries.
 */
export function deleteQueryParamCaseInsensitive(
    searchParams: URLSearchParams,
    key: string
): void {
    const target = key.toLowerCase();
    const matchingKeys = [...searchParams.keys()].filter(
        (paramKey) => paramKey.toLowerCase() === target
    );
    for (const paramKey of matchingKeys) {
        searchParams.delete(paramKey);
    }
}
