import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { authenticatedWalletApi } from "../../common/api/backendClient";
import { rewardsKey } from "../../common/queryKeys/rewards";
import type { RewardHistoryItem } from "../../types/RewardHistoryItem";

function toTimestamp(value: Date | string): number {
    const date = value instanceof Date ? value : new Date(value);
    const time = date.getTime();
    return Number.isNaN(time) ? 0 : time;
}

export function useGetRewardHistory() {
    const { address } = useAccount();

    const { data, error, isLoading, refetch } = useQuery({
        queryKey: rewardsKey.historyByAddress(address),
        queryFn: async (): Promise<{
            items: RewardHistoryItem[];
            totalCount: number;
        } | null> => {
            if (!address) {
                return null;
            }
            const { data, error } =
                await authenticatedWalletApi.rewards.history.get();
            if (error) throw error;
            if (!data) return null;

            return {
                items: data.items.map((item) => ({
                    ...item,
                    createdAt: toTimestamp(item.createdAt),
                    settledAt: item.settledAt
                        ? toTimestamp(item.settledAt)
                        : undefined,
                })),
                totalCount: data.totalCount,
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
