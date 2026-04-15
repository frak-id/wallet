import { getMergeToken } from "@frak-labs/core-sdk/actions";
import { ClientNotFound, type FrakRpcError } from "@frak-labs/frame-connector";
import { type UseQueryOptions, useQuery } from "@tanstack/react-query";
import { useFrakClient } from "./useFrakClient";

/** @ignore */
type QueryOptions = Omit<
    UseQueryOptions<string | null, FrakRpcError, string | null>,
    "queryKey" | "queryFn"
>;

/** @inline */
interface UseGetMergeTokenParams {
    /**
     * Optional query options, see {@link @tanstack/react-query!useQuery | `useQuery()`} for more infos
     */
    query?: QueryOptions;
    /**
     * Time in ms to cache the result at the core SDK level. Default: 30_000 (30s). Set to 0 to disable.
     */
    cacheTime?: number;
}

/**
 * Hook that return a query to fetch a merge token for the current anonymous identity
 *
 * Used by in-app browser redirect flows to preserve identity
 * when switching from a WebView to the system browser.
 *
 * It's a {@link @tanstack/react-query!home | `tanstack`} wrapper around the {@link @frak-labs/core-sdk!actions.getMergeToken | `getMergeToken()`} action
 *
 * @param args - Optional config object with `query` for customizing the underlying {@link @tanstack/react-query!useQuery | `useQuery()`}
 *
 * @group hooks
 *
 * @returns
 * The query hook wrapping the `getMergeToken()` action
 * The `data` result is a `string | null`
 *
 * @see {@link @frak-labs/core-sdk!actions.getMergeToken | `getMergeToken()`} for more info about the underlying action
 * @see {@link @tanstack/react-query!useQuery | `useQuery()`} for more info about the useQuery options and response
 */
export function useGetMergeToken({
    query,
    cacheTime,
}: UseGetMergeTokenParams = {}) {
    const client = useFrakClient();

    return useQuery({
        ...query,
        queryKey: ["frak-sdk", "get-merge-token"],
        queryFn: async () => {
            if (!client) {
                throw new ClientNotFound();
            }
            return getMergeToken(client, { cacheTime });
        },
    });
}
