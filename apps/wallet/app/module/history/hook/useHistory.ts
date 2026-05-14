import { useMemo } from "react";
import { useGetRewardHistory } from "@/module/history/hook/useGetRewardHistory";
import { mergeHistoryEntries } from "@/module/history/utils/historyEntry";
import { useMoneriumOrders } from "@/module/monerium/hooks/useMoneriumOrders";

/**
 * Unified view over reward history items and Monerium redeem orders.
 *
 * Both sources are pulled in parallel by their own hooks (independent
 * TanStack Query keys), merged into a discriminated-union list and sorted
 * by timestamp descending. Either source being unavailable (Monerium not
 * connected, no wallet) yields an empty array on that side — no error.
 */
export function useHistory() {
    const {
        items: rewards,
        totalCount: rewardCount,
        isLoading: isRewardsLoading,
        error: rewardsError,
        refetch: refetchRewards,
    } = useGetRewardHistory();

    const {
        orders,
        isLoading: isOrdersLoading,
        error: ordersError,
        refetch: refetchOrders,
    } = useMoneriumOrders();

    const entries = useMemo(
        () => mergeHistoryEntries(rewards, orders),
        [rewards, orders]
    );

    return {
        entries,
        rewards,
        orders,
        /** Total reward count from the backend (excludes Monerium orders). */
        rewardCount,
        /** Total entries currently in view (rewards + orders). */
        totalCount: entries.length,
        isLoading: isRewardsLoading || isOrdersLoading,
        error: rewardsError ?? ordersError,
        refetch: () =>
            Promise.all([refetchRewards(), refetchOrders()]),
    };
}
