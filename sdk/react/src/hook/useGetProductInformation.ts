import {
    ClientNotFound,
    type FrakRpcError,
    type GetProductInformationReturnType,
} from "@frak-labs/core-sdk";
import { getProductInformation } from "@frak-labs/core-sdk/actions";
import { type UseQueryOptions, useQuery } from "@tanstack/react-query";
import { useNexusClient } from "./useNexusClient";

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
    const client = useNexusClient();

    return useQuery({
        ...query,
        queryKey: ["nexus-sdk", "get-product-information"],
        queryFn: async () => {
            if (!client) {
                throw new ClientNotFound();
            }
            return getProductInformation(client);
        },
    });
}
