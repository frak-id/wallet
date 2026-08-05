import { queryOptions, useQuery } from "@tanstack/react-query";
import type { Hex } from "viem";
import { useConnection } from "wagmi";
import { authenticatedWalletApi } from "../../common/api/backendClient";
import { balanceKey } from "../../common/queryKeys/balance";

/**
 * Query options for the user balance.
 *
 * Shared by {@link useGetUserBalance} and the wallet route loader so both hit
 * the exact same cache entry (same key + same queryFn). Prefetching with a
 * different key would warm an entry the hook never reads.
 */
export function userBalanceQueryOptions(address?: Hex) {
    return queryOptions({
        queryKey: balanceKey.byAddress(address),
        queryFn: async () => {
            if (!address) {
                return null;
            }
            const { data, error } = await authenticatedWalletApi.balance.get();
            if (error) throw error;

            return data;
        },
        enabled: !!address,
    });
}

export function useGetUserBalance() {
    const { address } = useConnection();

    const { data, error, isLoading, refetch } = useQuery(
        userBalanceQueryOptions(address)
    );

    return {
        userBalance: data,
        error,
        isLoading,
        refetch,
    };
}
