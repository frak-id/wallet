import type { MerchantResolveResponse } from "@frak-labs/backend-elysia/api/schemas";
import { authenticatedBackendApi } from "@frak-labs/wallet-shared";
import { queryOptions, useQuery } from "@tanstack/react-query";

type MerchantResolvedConfigArgs = {
    merchantId?: string;
    lang?: string;
};

/**
 * TanStack Query options to fetch the backend-resolved merchant config by merchantId.
 *
 * Returns the full {@link MerchantResolveResponse} including `sdkConfig` (and its
 * `attribution` defaults). Callers can `select` only the fields they need.
 */
export function merchantResolvedConfigQueryOptions({
    merchantId,
    lang,
}: MerchantResolvedConfigArgs) {
    return queryOptions({
        queryKey: [
            "merchant",
            "resolvedConfig",
            merchantId ?? "no-merchant-id",
            lang ?? "no-lang",
        ],
        queryFn: async (): Promise<MerchantResolveResponse | null> => {
            if (!merchantId) return null;
            const { data, error } =
                await authenticatedBackendApi.user.merchant.resolve.get({
                    query: { merchantId, ...(lang && { lang }) },
                });
            if (error || !data) return null;
            return data as MerchantResolveResponse;
        },
        enabled: !!merchantId,
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
    });
}

/**
 * Hook to fetch the backend-resolved merchant config by merchantId.
 *
 * @example
 * ```tsx
 * const { data: attribution } = useMerchantResolvedConfig({
 *     merchantId,
 *     select: (config) => config?.sdkConfig?.attribution,
 * });
 * ```
 */
export function useMerchantResolvedConfig<
    TData = MerchantResolveResponse | null,
>({
    merchantId,
    lang,
    select,
}: MerchantResolvedConfigArgs & {
    select?: (config: MerchantResolveResponse | null) => TData;
}) {
    return useQuery({
        ...merchantResolvedConfigQueryOptions({ merchantId, lang }),
        select,
    });
}
