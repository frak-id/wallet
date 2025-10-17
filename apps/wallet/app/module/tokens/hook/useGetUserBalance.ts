import { balanceKey } from "@frak-labs/wallet-shared/common/queryKeys/balance";
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { authenticatedWalletApi } from "@/module/common/api/backendClient";

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
    });

    return {
        userBalance: data,
        error,
        isLoading,
        refetch,
    };
}
