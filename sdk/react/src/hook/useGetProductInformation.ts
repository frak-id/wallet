import {
    ClientNotFound,
    type FrakRpcError,
    type GetProductInformationReturnType,
} from "@frak-labs/core-sdk";
import { getProductInformation } from "@frak-labs/core-sdk/actions";
import { type UseQueryOptions, useQuery } from "@tanstack/react-query";
import { useFrakClient } from "./useFrakClient";

/** @inline */
type QueryOptions = Omit<
    UseQueryOptions<GetProductInformationReturnType, FrakRpcError, undefined>,
    "queryKey" | "queryFn"
>;

/** @inline */
interface UseGetProductInformationParams {
    query?: QueryOptions;
}

/**
 * Hook that return a query helping to get the current product informations
 * @param args
 * @param args.query - The query options, see {@link @tanstack/react-query!useQuery | `useQuery()`}
 *
 * @group hooks
 *
 * @see {@link @frak-labs/core-sdk!actions.getProductInformation | `getProductInformation()`} for more info about the underlying action
 * @see {@link @tanstack/react-query!useQuery | `useQuery()`} for more info about the useQuery options and response
 */
export function useGetProductInformation({
    query,
}: UseGetProductInformationParams = {}) {
    const client = useFrakClient();

    return useQuery({
        ...query,
        queryKey: ["frak-sdk", "get-product-information"],
        queryFn: async () => {
            if (!client) {
                throw new ClientNotFound();
            }
            return getProductInformation(client);
        },
    });
}
