import {
    ClientNotFound,
    type FrakRpcError,
    type GetProductInformationReturnType,
} from "@frak-labs/core-sdk";
import { getProductInformation } from "@frak-labs/core-sdk/actions";
import { type UseQueryOptions, useQuery } from "@tanstack/react-query";
import { useFrakClient } from "./useFrakClient";

/** @ignore */
type QueryOptions = Omit<
    UseQueryOptions<GetProductInformationReturnType, FrakRpcError, undefined>,
    "queryKey" | "queryFn"
>;

/** @inline */
interface UseGetProductInformationParams {
    /**
     * Optional query options, see {@link @tanstack/react-query!useQuery | `useQuery()`} for more infos
     */
    query?: QueryOptions;
}

/**
 * Hook that return a query helping to get the current product information
 *
 * It's a {@link @tanstack/react-query!home | `tanstack`} wrapper around the {@link @frak-labs/core-sdk!actions.getProductInformation | `getProductInformation()`} action
 *
 * @param args
 *
 * @group hooks
 *
 * @returns
 * The query hook wrapping the `getProductInformation()` action
 * The `data` result is a {@link @frak-labs/core-sdk!index.GetProductInformationReturnType | `GetProductInformationReturnType`}
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
