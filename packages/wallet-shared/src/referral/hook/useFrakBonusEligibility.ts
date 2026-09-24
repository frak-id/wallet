import { useCallback } from "react";
import { useReferralStatus } from "./useReferralStatus";

/**
 * Frak welcome-bonus availability, derived from the global referral status.
 * `isEligible` ignores merchant-scoped referrers shadowing Frak: callers that
 * know the merchant also check `useReferralStatus({ merchantId })`.
 */
export function useFrakBonusEligibility() {
    const { data } = useReferralStatus();
    const claimedMerchantIds = data?.frakReferral?.claimedMerchantIds;

    const isEligible = useCallback(
        (merchantId: string) =>
            claimedMerchantIds !== undefined &&
            !claimedMerchantIds.includes(merchantId),
        [claimedMerchantIds]
    );

    return { isFrakReferred: claimedMerchantIds !== undefined, isEligible };
}
