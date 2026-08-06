import {
    paramCodec,
    SHARING_PARAMS,
    type SharingParamKey,
    type SharingSearch,
} from "./table";

/**
 * Decode the query string into the route's search params. Every table key is
 * produced, absent ones as `undefined`, because TanStack Router's
 * `validateSearch` owns the whole search object.
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
