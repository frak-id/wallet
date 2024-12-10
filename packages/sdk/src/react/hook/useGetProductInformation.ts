import { type UseQueryOptions, useQuery } from "@tanstack/react-query";
import type { FrakRpcError, GetProductInformationReturnType } from "../../core";
import { getProductInformation } from "../../core/actions";
import { ClientNotFound } from "../../core/types/rpc/error";
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
