import { type MutationOptions, useMutation } from "@tanstack/react-query";
import { authenticatedWalletApi } from "../../common/api/backendClient";
import { referralKey } from "../queryKeys";

type UseRevokeReferralCodeProps = {
    mutations?: MutationOptions<void, Error, void>;
};

/**
 * Revoke the authenticated wallet's active referral code. No-op
 * server-side if there is no active code (returns 204 either way).
 */
export function useRevokeReferralCode({
    mutations,
}: UseRevokeReferralCodeProps = {}) {
    return useMutation({
        ...mutations,
        mutationKey: referralKey.revoke,
        mutationFn: async () => {
            const { error } =
                await authenticatedWalletApi.referral.code.delete();
            if (error) throw error;
        },
    });
}
