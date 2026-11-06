import {
    authenticatedWalletApi,
    type RewardHistoryItem,
    rewardsKey,
} from "@frak-labs/wallet-shared";
import {
    type InfiniteData,
    useInfiniteQuery,
    useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { useConnection } from "wagmi";

const PAGE_SIZE = 20;

type RewardHistoryPage = {
    items: RewardHistoryItem[];
    totalCount: number;
};

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

    const {
        data,
        error,
        isLoading,
        refetch,
        hasNextPage,
        fetchNextPage,
        isFetchingNextPage,
        isFetchNextPageError,
    } = useInfiniteQuery({
        queryKey: rewardsKey.historyByAddress(address),
        initialPageParam: 0,
        queryFn: async ({ pageParam }): Promise<RewardHistoryPage> => {
            const { data, error } =
                await authenticatedWalletApi.rewards.history.get({
                    query: { offset: pageParam, limit: PAGE_SIZE },
                });
            if (error) throw error;

            return {
                items: (data?.items ?? []).map((item) => ({
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
                totalCount: data?.totalCount ?? 0,
            };
        },
        getNextPageParam: (lastPage, pages) => {
            const loaded = pages.reduce(
                (count, page) => count + page.items.length,
                0
            );
            return lastPage.items.length > 0 && loaded < lastPage.totalCount
                ? loaded
                : undefined;
        },
        enabled: !!address,
        refetchOnMount: true,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
    });

    // Offset pages overlap when a new reward lands between two fetches.
    const items = useMemo(() => {
        const seen = new Set<string>();
        return (data?.pages ?? [])
            .flatMap((page) => page.items)
            .filter((item) => {
                if (seen.has(item.id)) return false;
                seen.add(item.id);
                return true;
            });
    }, [data]);

    return {
        items,
        totalCount: data?.pages.at(-1)?.totalCount ?? 0,
        isLoading,
        error,
        refetch,
        hasNextPage,
        fetchNextPage,
        isFetchingNextPage,
        isFetchNextPageError,
    };
}

/** Drops the older pages on unmount, so later refetches cost one request, not one per page. */
export function useTrimRewardHistoryOnLeave() {
    const queryClient = useQueryClient();
    const { address } = useConnection();

    useEffect(
        () => () => {
            const queryKey = rewardsKey.historyByAddress(address);
            // Trim synchronously: the next page's observer may refetch in this same commit.
            void queryClient.cancelQueries({ queryKey });
            queryClient.setQueryData<InfiniteData<RewardHistoryPage, number>>(
                queryKey,
                (data) =>
                    data && {
                        pages: data.pages.slice(0, 1),
                        pageParams: data.pageParams.slice(0, 1),
                    },
                {
                    updatedAt:
                        queryClient.getQueryState(queryKey)?.dataUpdatedAt,
                }
            );
        },
        [queryClient, address]
    );
}
