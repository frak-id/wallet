import { authenticatedBackendApi } from "@frak-labs/wallet-shared";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useStore } from "zustand";
import { sortMerchants } from "@/module/explorer/sortMerchants";
import { explorerSortStore } from "@/module/explorer/stores/explorerSortStore";

export const explorerKeys = {
    all: ["explorer"] as const,
    list: (params: { limit: number; offset: number }) =>
        [...explorerKeys.all, "list", params] as const,
};

/**
 * Query options for the explorer merchant list.
 *
 * Shared by {@link useGetExplorerMerchants} and the `/explorer` route loader so
 * both hit the exact same cache entry (same key + same queryFn). Sorting stays
 * out of here on purpose: it depends on the client-side sort store and would
 * otherwise leak a React-only concern into the loader.
 */
export function explorerMerchantsQueryOptions({
    limit,
    offset,
}: {
    limit: number;
    offset: number;
}) {
    return queryOptions({
        queryKey: explorerKeys.list({ limit, offset }),
        queryFn: async () => {
            const { data, error } =
                await authenticatedBackendApi.user.merchant.explore.get({
                    query: { limit, offset },
                });
            if (error) throw error;
            return data;
        },
    });
}

/**
 * The page the explorer route renders by default.
 *
 * Shared with the route loader: the prefetch only warms the entry the hook
 * reads if the pagination args match exactly, and two separately-written
 * literals can drift with no compile error.
 */
export const EXPLORER_DEFAULT_PAGE = { limit: 20, offset: 0 } as const;

export function useGetExplorerMerchants({
    limit = EXPLORER_DEFAULT_PAGE.limit,
    offset = EXPLORER_DEFAULT_PAGE.offset,
}: {
    limit?: number;
    offset?: number;
} = {}) {
    const sort = useStore(explorerSortStore, (s) => s.sort);
    const { data, error, isLoading, refetch } = useQuery(
        explorerMerchantsQueryOptions({ limit, offset })
    );

    // `/explore` carries every sort signal (popularity, recent, expiring,
    // reward) per merchant, so sorting is a pure client-side reorder.
    const merchants = useMemo(
        () => sortMerchants(data?.merchants ?? [], sort),
        [data?.merchants, sort]
    );

    return {
        merchants,
        totalResult: data?.totalResult ?? 0,
        error,
        isLoading,
        refetch,
    };
}
