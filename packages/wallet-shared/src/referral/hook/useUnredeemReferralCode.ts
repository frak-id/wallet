import { type MutationOptions, useMutation } from "@tanstack/react-query";
import { authenticatedWalletApi } from "../../common/api/backendClient";
import { referralKey } from "../queryKeys";

type UseUnredeemReferralCodeProps = {
    mutations?: MutationOptions<void, Error, void>;
};

/**
 * Remove the authenticated wallet's active cross-merchant referrer (the
 * one created by redeeming a referral code in wallet settings). Returns
 * 204 on success or 404 if there is no active referrer.
 */
export function useUnredeemReferralCode({
    mutations,
}: UseUnredeemReferralCodeProps = {}) {
    return useMutation({
        ...mutations,
        mutationKey: referralKey.unredeem,
        mutationFn: async () => {
            const { error } =
                await authenticatedWalletApi.referral.redemption.delete();
            if (error) throw error;
        },
    });
}
