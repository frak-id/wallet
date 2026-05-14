import {
    type MutationOptions,
    useMutation,
    useQueryClient,
} from "@tanstack/react-query";
import { authenticatedWalletApi } from "../../common/api/backendClient";
import { referralKey } from "../queryKeys";

type UseUnredeemReferralCodeProps = {
    mutations?: MutationOptions<void, Error, void>;
};

/**
 * Remove the authenticated wallet's active cross-merchant referrer (the
 * one created by redeeming a referral code in wallet settings). Returns
 * 204 on success or 404 if there is no active referrer.
 *
 * Invalidates `referralKey.status` on success so the settings panel
 * reflects the removed referrer without waiting for `useReferralStatus`'s
 * 30s staleTime to expire.
 */
export function useUnredeemReferralCode({
    mutations,
}: UseUnredeemReferralCodeProps = {}) {
    const queryClient = useQueryClient();
    return useMutation({
        ...mutations,
        mutationKey: referralKey.unredeem,
        mutationFn: async () => {
            const { error } =
                await authenticatedWalletApi.referral.redemption.delete();
            if (error) throw error;
        },
        onSuccess: (...args) => {
            queryClient.invalidateQueries({ queryKey: referralKey.status() });
            mutations?.onSuccess?.(...args);
        },
    });
}
