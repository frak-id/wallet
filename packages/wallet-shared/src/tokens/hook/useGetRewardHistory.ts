import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { authenticatedWalletApi } from "../../common/api/backendClient";
import { rewardsKey } from "../../common/queryKeys/rewards";
import type { RewardHistoryItem } from "../../types/RewardHistoryItem";

function getTimestamp(value: Date | string): number {
    const date = value instanceof Date ? value : new Date(value);
    const time = date.getTime();
    return Number.isNaN(time) ? 0 : time;
}

function mapItem(raw: Record<string, unknown>): RewardHistoryItem {
    const item = raw as {
        merchant: RewardHistoryItem["merchant"];
        token: RewardHistoryItem["token"];
        amount: RewardHistoryItem["amount"];
        status: string;
        role: string;
        trigger: string;
        txHash?: string;
        createdAt: Date | string;
        settledAt?: Date | string;
        purchase?: RewardHistoryItem["purchase"];
    };

    return {
        merchant: item.merchant,
        token: item.token,
        amount: item.amount,
        status: item.status as RewardHistoryItem["status"],
        role: item.role as RewardHistoryItem["role"],
        trigger: item.trigger as RewardHistoryItem["trigger"],
        txHash: item.txHash,
        createdAt: getTimestamp(item.createdAt),
        settledAt: item.settledAt ? getTimestamp(item.settledAt) : undefined,
        purchase: item.purchase,
    };
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

            const items = (data as { items?: unknown[] }).items ?? [];

            return {
                items: (items as Record<string, unknown>[]).map(mapItem),
                totalCount: (data as { totalCount?: number }).totalCount ?? 0,
            };
        },
        enabled: !!address,
        refetchOnMount: true,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
    });

    return {
        items: data?.items ?? [],
        totalCount: data?.totalCount ?? 0,
        isLoading,
        error,
        refetch,
    };
}
