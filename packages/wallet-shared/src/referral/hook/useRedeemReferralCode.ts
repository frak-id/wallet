import { type MutationOptions, useMutation } from "@tanstack/react-query";
import { authenticatedWalletApi } from "../../common/api/backendClient";
import { referralKey } from "../queryKeys";

type RedeemInput = {
    /** 6-char referral code received from another user. */
    code: string;
};

type UseRedeemReferralCodeProps = {
    mutations?: MutationOptions<void, Error, RedeemInput>;
};

/**
 * Redeem a referral code for the authenticated wallet. Backend errors:
 * 400 (invalid format), 404 (code not found), 409 (already redeemed).
 */
export function useRedeemReferralCode({
    mutations,
}: UseRedeemReferralCodeProps = {}) {
    return useMutation({
        ...mutations,
        mutationKey: referralKey.redeem,
        mutationFn: async ({ code }: RedeemInput) => {
            const { error } =
                await authenticatedWalletApi.referral.code.redeem.post({
                    code,
                });
            if (error) throw error;
        },
    });
}
