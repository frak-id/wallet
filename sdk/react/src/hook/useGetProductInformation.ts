import {
    ClientNotFound,
    type FrakRpcError,
    type GetProductInformationReturnType,
} from "@frak-labs/core-sdk";
import { getProductInformation } from "@frak-labs/core-sdk/actions";
import { type UseQueryOptions, useQuery } from "@tanstack/react-query";
import { useFrakClient } from "./useFrakClient";

type QueryOptions = Omit<
    UseQueryOptions<GetProductInformationReturnType, FrakRpcError, undefined>,
    "queryKey" | "queryFn"
>;

interface UseGetProductInformationParams {
    query?: QueryOptions;
}

/**
 * Open the SSO
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
