import { authenticatedWalletApi } from "@/module/common/api/backendClient";
import { pendingBalanceKey } from "@/module/common/queryKeys/pendingBalance";
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";

export function useGetUserPendingBalance() {
    const { address } = useAccount();

    const { data, error, isLoading, refetch } = useQuery({
        queryKey: pendingBalanceKey.byAddress(address),
        queryFn: async () => {
            if (!address) {
                return null;
            }
            const { data, error } =
                await authenticatedWalletApi.balance.pending.get();
            if (error) throw error;

            return data;
        },
        enabled: !!address,
        refetchOnMount: true,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
    });

    return {
        userPendingBalance: data,
        error,
        isLoading,
        refetch,
    };
}
