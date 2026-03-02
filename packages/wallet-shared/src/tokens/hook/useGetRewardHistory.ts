import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { authenticatedWalletApi } from "../../common/api/backendClient";
import { rewardsKey } from "../../common/queryKeys/rewards";
import type {
    RecipientType,
    RewardHistoryItem,
    RewardStatus,
    TriggerType,
} from "../../types/RewardHistoryItem";

type BackendRewardItem = {
    id: string;
    amount: number;
    tokenAddress?: string;
    status: RewardStatus;
    recipientType: RecipientType;
    createdAt: Date | string;
    settledAt?: Date | string;
    onchainTxHash?: string;
    trigger?: TriggerType;
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

function getTimestamp(value: Date | string): number {
    const date = value instanceof Date ? value : new Date(value);
    const time = date.getTime();
    return Number.isNaN(time) ? 0 : time;
}

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
                rewards: rewards.map(
                    (item: BackendRewardItem): RewardHistoryItem => ({
                        id: item.id,
                        amount: item.amount,
                        timestamp: getTimestamp(item.createdAt),
                        txHash: item.onchainTxHash,
                        status: item.status,
                        trigger: item.trigger ?? null,
                        recipientType: item.recipientType,
                        merchant: item.merchant,
                        token: {
                            address: item.tokenAddress ?? "",
                            symbol: item.token.symbol,
                            decimals: item.token.decimals,
                            logo: item.token.logo,
                        },
                    })
                ),
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
