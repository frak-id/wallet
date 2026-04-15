import type { UserReferralStatusType } from "@frak-labs/core-sdk";
import { getUserReferralStatus } from "@frak-labs/core-sdk/actions";
import { ClientNotFound, type FrakRpcError } from "@frak-labs/frame-connector";
import { type UseQueryOptions, useQuery } from "@tanstack/react-query";
import { useFrakClient } from "./useFrakClient";

/** @ignore */
type QueryOptions = Omit<
    UseQueryOptions<
        UserReferralStatusType | null,
        FrakRpcError,
        UserReferralStatusType | null
    >,
    "queryKey" | "queryFn"
>;

/** @inline */
interface UseGetUserReferralStatusParams {
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
 * Hook that return a query to fetch the current user's referral status on the current merchant
 *
 * Returns `null` when the user's identity cannot be resolved.
 *
 * It's a {@link @tanstack/react-query!home | `tanstack`} wrapper around the {@link @frak-labs/core-sdk!actions.getUserReferralStatus | `getUserReferralStatus()`} action
 *
 * @param args - Optional config object with `query` for customizing the underlying {@link @tanstack/react-query!useQuery | `useQuery()`}
 *
 * @group hooks
 *
 * @returns
 * The query hook wrapping the `getUserReferralStatus()` action
 * The `data` result is a {@link @frak-labs/core-sdk!index.UserReferralStatusType | `UserReferralStatusType`} or `null`
 *
 * @see {@link @frak-labs/core-sdk!actions.getUserReferralStatus | `getUserReferralStatus()`} for more info about the underlying action
 * @see {@link @tanstack/react-query!useQuery | `useQuery()`} for more info about the useQuery options and response
 */
export function useGetUserReferralStatus({
    query,
    cacheTime,
}: UseGetUserReferralStatusParams = {}) {
    const client = useFrakClient();

    return useQuery({
        ...query,
        queryKey: ["frak-sdk", "get-user-referral-status"],
        queryFn: async () => {
            if (!client) {
                throw new ClientNotFound();
            }
            return getUserReferralStatus(client, { cacheTime });
        },
    });
}
