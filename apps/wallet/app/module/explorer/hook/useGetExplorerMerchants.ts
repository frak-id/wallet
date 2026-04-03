import { authenticatedBackendApi } from "@frak-labs/wallet-shared";
import { useQuery } from "@tanstack/react-query";

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

    return {
        merchants: data?.merchants ?? [],
        totalResult: data?.totalResult ?? 0,
        error,
        isLoading,
        refetch,
    };
}
