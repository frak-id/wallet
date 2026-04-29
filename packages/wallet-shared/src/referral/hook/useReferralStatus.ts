import { useQuery } from "@tanstack/react-query";
import { authenticatedWalletApi } from "../../common/api/backendClient";
import { selectWebauthnSession, sessionStore } from "../../stores/sessionStore";
import { referralKey } from "../queryKeys";

/**
 * Read the authenticated wallet's referral status: own code (if any) and
 * which referrer redeemed them, optionally scoped to a merchant.
 */
export function useReferralStatus({
    merchantId,
}: {
    merchantId?: string;
} = {}) {
    const wallet = sessionStore(selectWebauthnSession);

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
        enabled: !!wallet?.address,
    });
}
