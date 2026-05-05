import {
    authenticatedWalletApi,
    type RewardHistoryItem,
    rewardsKey,
} from "@frak-labs/wallet-shared";
import { useQuery } from "@tanstack/react-query";
import { useConnection } from "wagmi";

function toTimestamp(value: Date | string): number {
    const date = value instanceof Date ? value : new Date(value);
    const time = date.getTime();
    return Number.isNaN(time) ? 0 : time;
}

/**
 * Display "settled" rewards as "consumed".
 *
 * The backend cannot currently observe the on-chain settled → consumed
 * transition (no event surfaces back). Until that signal exists we treat
 * settled rewards as consumed for display purposes.
 */
function toDisplayStatus(
    status: RewardHistoryItem["status"]
): RewardHistoryItem["status"] {
    return status === "settled" ? "consumed" : status;
}

export function useGetRewardHistory() {
    const { address } = useConnection();

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
                    status: toDisplayStatus(item.status),
                    createdAt: toTimestamp(item.createdAt),
                    settledAt: item.settledAt
                        ? toTimestamp(item.settledAt)
                        : undefined,
                    availableAt: item.availableAt
                        ? toTimestamp(item.availableAt)
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
