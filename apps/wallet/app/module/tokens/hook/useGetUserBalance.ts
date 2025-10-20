import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { authenticatedWalletApi } from "@/module/common/api/backendClient";
import { balanceKey } from "@/module/common/queryKeys/balance";

export function useGetUserBalance() {
    const { address } = useAccount();

    const { data, error, isLoading, refetch } = useQuery({
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
        // Only refetch on mount if data is stale (respects global staleTime of 60s)
        refetchOnMount: true,
    });

    return {
        userBalance: data,
        error,
        isLoading,
        refetch,
    };
}
