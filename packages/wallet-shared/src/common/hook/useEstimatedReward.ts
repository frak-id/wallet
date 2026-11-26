import type { MerchantReward } from "@frak-labs/core-sdk";
import { authenticatedBackendApi } from "../api/backendClient";
import { merchantKey } from "../queryKeys/merchant";
import { queryOptions } from "../utils/queryOptions";

export function estimatedRewardsQueryOptions(merchantId?: string) {
    return queryOptions({
        queryKey: merchantKey.estimatedRewards(merchantId),
        queryFn: async (): Promise<MerchantReward[]> => {
            if (!merchantId) return [];

            const { data, error } = await authenticatedBackendApi.user.merchant[
                "estimated-rewards"
            ].get({
                query: { merchantId },
            });

            if (error) throw error;

            return (data?.rewards ?? []) as MerchantReward[];
        },
        enabled: !!merchantId,
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
    });
}
