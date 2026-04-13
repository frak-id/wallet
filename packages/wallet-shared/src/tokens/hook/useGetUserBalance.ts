import { useQuery } from "@tanstack/react-query";
import { useConnection } from "wagmi";
import { authenticatedWalletApi } from "../../common/api/backendClient";
import { balanceKey } from "../../common/queryKeys/balance";

export function useGetUserBalance() {
    const { address } = useConnection();

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
    });

    return {
        userBalance: data,
        error,
        isLoading,
        refetch,
    };
}
