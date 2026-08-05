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
 * `nativeOnly` params are gated on `embed`, which is therefore decoded first.
 * That ordering is the whole protection — a web visitor typing
 * `?cornerRadius=200` gets nothing, because they cannot also claim `embed`
 * without tripping the `clientId` guard in `beforeLoad`.
 */
export function parseSharingSearch(
    search: Record<string, unknown>
): SharingSearch {
    const embed = SHARING_PARAMS.embed.decode(search.embed);
    const decoded: Record<string, unknown> = {};

    for (const key of Object.keys(SHARING_PARAMS) as SharingParamKey[]) {
        const codec = paramCodec(key);
        if (codec.nativeOnly && embed === undefined) {
            decoded[key] = undefined;
            continue;
        }
        decoded[key] = codec.decode(search[key]);
    }

    return decoded as SharingSearch;
}
