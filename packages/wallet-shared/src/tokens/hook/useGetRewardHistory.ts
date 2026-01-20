import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { authenticatedWalletApi } from "../../common/api/backendClient";
import { rewardsKey } from "../../common/queryKeys/rewards";
import type { RewardHistoryItem } from "../../types/RewardHistoryItem";

type BackendRewardItem = {
    id: string;
    amount: number;
    tokenAddress?: string;
    status: string;
    recipientType: string;
    createdAt: Date;
    settledAt?: Date;
    onchainTxHash?: string;
    trigger?: string;
    merchant: {
        name: string;
        domain: string;
    };
    token: {
        symbol: string;
        decimals: number;
        logo?: string;
    };
};

export function useGetRewardHistory() {
    const { address } = useAccount();

    const { data, error, isLoading, refetch } = useQuery({
        queryKey: rewardsKey.historyByAddress(address),
        queryFn: async () => {
            if (!address) {
                return null;
            }
            const { data, error } =
                await authenticatedWalletApi.rewards.history.get();
            if (error) throw error;

            if (!data) return null;

            const rewards = data.rewards ?? [];
            const total = rewards.length;

            return {
                rewards: rewards.map((item: BackendRewardItem) => ({
                    id: item.id,
                    amount: item.amount,
                    timestamp: item.createdAt.getTime(),
                    txHash: item.onchainTxHash ?? undefined,
                    status: item.status,
                    trigger: item.trigger ?? undefined,
                    recipientType: item.recipientType,
                    merchant: item.merchant,
                    token: {
                        address: item.tokenAddress ?? "",
                        symbol: item.token.symbol,
                        decimals: item.token.decimals,
                        logo: item.token.logo,
                    },
                })) as RewardHistoryItem[],
                total,
            };
        },
        enabled: !!address,
        refetchOnMount: true,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
    });

    return {
        rewards: data?.rewards ?? [],
        total: data?.total ?? 0,
        isLoading,
        error,
        refetch,
    };
}
