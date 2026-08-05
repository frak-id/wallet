import {
    paramCodec,
    SHARING_PARAMS,
    type SharingParamKey,
    type SharingSearch,
} from "./table";

/**
 * Decode the query string into the route's search params.
 *
 * Every key in the table is produced, absent ones as `undefined`, because
 * TanStack Router's `validateSearch` owns the whole search object: a key it
 * omits is a key the route cannot read.
 *
 * No param is gated on `embed` any more. The one that was — `cornerRadius`,
 * which let a host reach into this page's geometry and therefore had to be
 * kept away from a web visitor typing `?cornerRadius=200` — is gone entirely:
 * presentation now arrives as CSS custom properties a native host injects into
 * its own web view, which a URL cannot forge. Should a host-only param appear
 * again, the gate is a `nativeOnly` flag on `ParamCodec` plus a check here; it
 * was removed rather than left guarding nothing.
 */
export function parseSharingSearch(
    search: Record<string, unknown>
): SharingSearch {
    const decoded: Record<string, unknown> = {};

    for (const key of Object.keys(SHARING_PARAMS) as SharingParamKey[]) {
        decoded[key] = paramCodec(key).decode(search[key]);
    }

    return decoded as SharingSearch;
}
