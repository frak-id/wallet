import { authenticatedBackendApi } from "@frak-labs/wallet-shared";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useStore } from "zustand";
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
