import { authenticatedBackendApi } from "@/module/common/api/backendClient";
import { tokensQueryKeys } from "@/module/tokens/queryKeys/tokens";
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";

export function useGetUserPendingBalance() {
    const { address } = useAccount();

    const { data, error, isLoading, refetch } = useQuery({
        queryKey: tokensQueryKeys.pendingBalance.byAddress(address),
        queryFn: async () => {
            if (!address) {
                return null;
            }
            const { data, error } =
                await authenticatedBackendApi.wallet["pending-balance"].get();
            if (error) throw error;

            return data;
        },
        enabled: !!address,
    });

    return {
        userPendingBalance: data,
        error,
        isLoading,
        refetch,
    };
}
