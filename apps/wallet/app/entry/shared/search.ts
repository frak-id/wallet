/**
 * Query-string source for the router-free entrypoints.
 *
 * The SPA reads its params through TanStack Router, which JSON-parses every
 * search value; here they stay strings. That difference is deliberate and the
 * param codecs already absorb it — `looseStr` exists precisely because the
 * router turns a numeric-looking id into a `number`, and `products` accepts a
 * JSON-stringified array as well as a real one. Strings are the stricter of
 * the two inputs, so nothing the SDKs send can decode here and not there.
 */
export function searchParamsFromLocation(
    search: string = window.location.search
): Record<string, string> {
    return Object.fromEntries(new URLSearchParams(search));
}
