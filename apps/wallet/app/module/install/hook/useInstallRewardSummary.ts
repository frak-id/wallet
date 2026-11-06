import {
    type Currency,
    type FiatAmounts,
    formatAmount,
    getSupportedCurrency,
    type RewardSummary,
} from "@frak-labs/core-sdk";
import { authenticatedBackendApi } from "@frak-labs/wallet-shared/common/api/backendClient";
import { useQuery } from "@tanstack/react-query";
import { getRewardDaysLeft } from "@/module/install/utils/rewardCountdown";

const SUMMARY_TIMEOUT_MS = 1500;

export type InstallPendingReward = {
    amount: string;
    daysLeft: number | undefined;
};

/** The visitor's own rewards at this merchant; needs the install proof, and failing or stalling leaves the page on the estimate. */
export function useInstallRewardSummary({
    merchantId,
    anonymousId,
    proof,
    currency,
    currencyLoading = false,
}: {
    merchantId?: string;
    anonymousId?: string;
    proof?: string;
    currency?: Currency;
    currencyLoading?: boolean;
}): { pendingReward: InstallPendingReward | undefined; isLoading: boolean } {
    const enabled = Boolean(merchantId && anonymousId && proof);
    const { data, isLoading } = useQuery({
        queryKey: ["install", "rewards-summary", merchantId, anonymousId],
        queryFn: async (): Promise<RewardSummary | null> => {
            if (!(merchantId && anonymousId && proof)) return null;
            const request = authenticatedBackendApi.user.merchant[
                "rewards-summary"
            ].get({
                query: { merchantId },
                headers: {
                    "x-frak-client-id": anonymousId,
                    "x-frak-proof": proof,
                },
            });
            const stalled = new Promise<null>((resolve) =>
                setTimeout(resolve, SUMMARY_TIMEOUT_MS, null)
            );
            const result = await Promise.race([request, stalled]);
            if (!result) return null;
            if (result.error) throw result.error;
            return result.data;
        },
        enabled,
        retry: false,
        staleTime: 60_000,
    });

    const pendingReward = toPendingReward(data, currency);
    return {
        pendingReward,
        isLoading: isLoading || (currencyLoading && Boolean(pendingReward)),
    };
}

function toPendingReward(
    summary: RewardSummary | null | undefined,
    currency: Currency | undefined
): InstallPendingReward | undefined {
    if (!summary || summary.linked) return undefined;
    const { pending } = summary;
    if (!pending || pending.count === 0) return undefined;
    return {
        amount: formatAmount(pickFiat(pending.total, currency), currency),
        daysLeft: getRewardDaysLeft(pending.expiresAt),
    };
}

function pickFiat(
    amounts: FiatAmounts,
    currency: Currency | undefined
): number {
    switch (getSupportedCurrency(currency)) {
        case "usd":
            return amounts.usdAmount;
        case "gbp":
            return amounts.gbpAmount;
        default:
            return amounts.eurAmount;
    }
}
