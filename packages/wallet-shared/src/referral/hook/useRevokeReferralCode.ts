import {
    type MutationOptions,
    useMutation,
    useQueryClient,
} from "@tanstack/react-query";
import { authenticatedWalletApi } from "../../common/api/backendClient";
import { referralKey } from "../queryKeys";

type UseRevokeReferralCodeProps = {
    mutations?: MutationOptions<void, Error, void>;
};

/**
 * Revoke the authenticated wallet's active referral code. No-op
 * server-side if there is no active code (returns 204 either way).
 *
 * Invalidates `referralKey.status` on success so the settings panel
 * reflects the now-empty active-code slot without waiting for
 * `useReferralStatus`'s 30s staleTime to expire.
 */
export function useRevokeReferralCode({
    mutations,
}: UseRevokeReferralCodeProps = {}) {
    const queryClient = useQueryClient();
    return useMutation({
        ...mutations,
        mutationKey: referralKey.revoke,
        mutationFn: async () => {
            const { error } =
                await authenticatedWalletApi.referral.code.delete();
            if (error) throw error;
        },
        onSuccess: (...args) => {
            queryClient.invalidateQueries({ queryKey: referralKey.status() });
            mutations?.onSuccess?.(...args);
        },
    });
}
