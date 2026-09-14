import type { UserReferralStatusType } from "@frak-labs/core-sdk";
import { authenticatedBackendApi } from "@frak-labs/wallet-shared/common/api/backendClient";
import { queryOptions } from "@frak-labs/wallet-shared/common/utils/queryOptions";

export function userReferralStatusQueryOptions(merchantId?: string) {
    return queryOptions({
        queryKey: [
            "merchant",
            "referralStatus",
            merchantId ?? "no-merchant-id",
        ] as const,
        queryFn: async (): Promise<UserReferralStatusType | null> => {
            if (!merchantId) return null;

            const { data, error } = await authenticatedBackendApi.user.merchant[
                "referral-status"
            ].get({
                query: { merchantId },
            });

            if (error || !data || !("isReferred" in data)) return null;

            return {
                isReferred: Boolean(data.isReferred),
            };
        },
        enabled: !!merchantId,
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
    });
}
