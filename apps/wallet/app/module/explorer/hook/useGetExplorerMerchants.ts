import {
    authenticatedBackendApi,
    estimatedRewardsQueryOptions,
} from "@frak-labs/wallet-shared";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useStore } from "zustand";
import {
    computeRewardSortValue,
    type MerchantRewardSortValue,
} from "@/module/explorer/explorerRewardSort";
import { sortMerchants } from "@/module/explorer/sortMerchants";
import { explorerSortStore } from "@/module/explorer/stores/explorerSortStore";

const explorerKeys = {
    all: ["explorer"] as const,
    list: (params: { limit: number; offset: number }) =>
        [...explorerKeys.all, "list", params] as const,
};

export function useGetExplorerMerchants({
    limit = 20,
    offset = 0,
}: {
    limit?: number;
    offset?: number;
} = {}) {
    const sort = useStore(explorerSortStore, (s) => s.sort);
    const { data, error, isLoading, refetch } = useQuery({
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

    const merchantList = useMemo(
        () => data?.merchants ?? [],
        [data?.merchants]
    );

    // `reward`/`expiring` need per-merchant `estimated-rewards`, fetched only
    // while one of those sorts is active. Interim until `/explore` carries them.
    const needsRewardData = sort === "reward" || sort === "expiring";
    const { rewardValues, isSortLoading } = useQueries({
        queries: merchantList.map((merchant) => ({
            ...estimatedRewardsQueryOptions(merchant.id),
            enabled: needsRewardData,
        })),
        combine: (results) => {
            if (!needsRewardData) {
                return { rewardValues: undefined, isSortLoading: false };
            }
            const rewardValues = new Map<string, MerchantRewardSortValue>();
            merchantList.forEach((merchant, index) => {
                rewardValues.set(
                    merchant.id,
                    computeRewardSortValue(results[index]?.data ?? [])
                );
            });
            // isSortLoading keeps the skeleton up instead of a visible reorder.
            return {
                rewardValues,
                isSortLoading: results.some((result) => result.isLoading),
            };
        },
    });

    const merchants = sortMerchants(merchantList, sort, rewardValues);

    return {
        merchants,
        totalResult: data?.totalResult ?? 0,
        error,
        isLoading: isLoading || isSortLoading,
        refetch,
    };
}
