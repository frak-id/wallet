import {
    type MutationOptions,
    useMutation,
    useQueryClient,
} from "@tanstack/react-query";
import { authenticatedWalletApi } from "../../common/api/backendClient";
import { referralKey } from "../queryKeys";

type ReplaceInput = {
    /** New 6-char code (typically picked from `suggest`). */
    code: string;
};

type ReplaceResult = {
    code: string;
    createdAt: string;
};

type UseReplaceReferralCodeProps = {
    mutations?: MutationOptions<ReplaceResult, Error, ReplaceInput>;
};

/**
 * Rotate the authenticated wallet's active referral code: revoke the old
 * one, then issue the new one. The backend has no atomic rotate endpoint,
 * so this is a best-effort chain. If `issue` fails after `revoke`
 * succeeds the user is left without an active code; the next retry's
 * revoke step is a no-op (404 is treated as success below) so the user
 * can simply pick another code from the same form and try again.
 */
export function useReplaceReferralCode({
    mutations,
}: UseReplaceReferralCodeProps = {}) {
    const queryClient = useQueryClient();
    return useMutation({
        ...mutations,
        mutationKey: referralKey.replace,
        mutationFn: async ({ code }: ReplaceInput) => {
            const revoked = await authenticatedWalletApi.referral.code.delete();
            // Revoke is idempotent: 204 if there was an active code, 404 if
            // not (e.g. retry after a previous issue failure). Either is fine.
            if (revoked.error && revoked.status !== 404) throw revoked.error;

            // Past this point we know the wallet has no active code on the
            // server — either we just revoked it (204) or it was already
            // gone (404). Invalidate the status cache before attempting
            // `issue` so consumers reading it (e.g. the share page mounted
            // under the edit sheet) reflect truth even if `issue` throws
            // below. We deliberately don't invalidate when revoke errors
            // out non-404, because that path leaves the active code intact.
            queryClient.invalidateQueries({
                queryKey: referralKey.status(),
            });

            const { data, error } =
                await authenticatedWalletApi.referral.code.issue.post({
                    code,
                });
            if (error) throw error;
            return data;
        },
    });
}
