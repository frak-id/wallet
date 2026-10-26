import { authenticatedWalletApi, rewardsKey } from "@frak-labs/wallet-shared";
import { useQuery } from "@tanstack/react-query";
import { useConnection } from "wagmi";

/** EUR value of the rewards not on-chain yet: locked, pending validation, waiting on funding. */
export function useGetUnpaidRewards() {
    const { address } = useConnection();

    const { data } = useQuery({
        queryKey: rewardsKey.unpaidByAddress(address),
        queryFn: async () => {
            const { data, error } =
                await authenticatedWalletApi.rewards.unpaid.get();
            if (error) throw error;
            return data.eurAmount;
        },
        enabled: !!address,
    });

    return { totalUnpaid: data ?? 0 };
}
