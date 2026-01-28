import type { GetMerchantInformationReturnType } from "@frak-labs/core-sdk";
import { getMerchantInformation } from "@frak-labs/core-sdk/actions";
import { ClientNotFound, type FrakRpcError } from "@frak-labs/frame-connector";
import { type UseQueryOptions, useQuery } from "@tanstack/react-query";
import { useFrakClient } from "./useFrakClient";

/** @ignore */
type QueryOptions = Omit<
    UseQueryOptions<GetMerchantInformationReturnType, FrakRpcError, undefined>,
    "queryKey" | "queryFn"
>;

/** @inline */
interface UseGetMerchantInformationParams {
    /**
     * Optional query options, see {@link @tanstack/react-query!useQuery | `useQuery()`} for more infos
     */
    query?: QueryOptions;
}

/**
 * Hook that return a query helping to get the current merchant information
 *
 * It's a {@link @tanstack/react-query!home | `tanstack`} wrapper around the {@link @frak-labs/core-sdk!actions.getMerchantInformation | `getMerchantInformation()`} action
 *
 * @param args
 *
 * @group hooks
 *
 * @returns
 * The query hook wrapping the `getMerchantInformation()` action
 * The `data` result is a {@link @frak-labs/core-sdk!index.GetMerchantInformationReturnType | `GetMerchantInformationReturnType`}
 *
 * @see {@link @frak-labs/core-sdk!actions.getMerchantInformation | `getMerchantInformation()`} for more info about the underlying action
 * @see {@link @tanstack/react-query!useQuery | `useQuery()`} for more info about the useQuery options and response
 */
export function useGetMerchantInformation({
    query,
}: UseGetMerchantInformationParams = {}) {
    const client = useFrakClient();

    return useQuery({
        ...query,
        queryKey: ["frak-sdk", "get-merchant-information"],
        queryFn: async () => {
            if (!client) {
                throw new ClientNotFound();
            }
            return getMerchantInformation(client);
        },
    });
}
