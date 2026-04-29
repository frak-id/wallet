import { useQuery } from "@tanstack/react-query";
import { authenticatedWalletApi } from "../../common/api/backendClient";
import { selectSession, sessionStore } from "../../stores/sessionStore";
import { referralKey } from "../queryKeys";

/**
 * Read the authenticated wallet's referral status: own code (if any) and
 * which referrer redeemed them, optionally scoped to a merchant.
 *
 * Enabled for any session type — referral status is per-identity, not
 * webauthn-specific.
 */
export function useReferralStatus({
    merchantId,
}: {
    merchantId?: string;
} = {}) {
    const session = sessionStore(selectSession);

    return useQuery({
        queryKey: referralKey.status(merchantId),
        queryFn: async () => {
            const { data, error } =
                await authenticatedWalletApi.referral.status.get({
                    query: merchantId ? { merchantId } : {},
                });
            if (error) throw error;
            return data;
        },
        enabled: !!session?.token,
        // Status only changes via `issue` / `revoke`, which we invalidate
        // explicitly. Hold the cache fresh for 30s so navigation between
        // hub → share → create doesn't refetch on every mount.
        staleTime: 30_000,
    });
}
