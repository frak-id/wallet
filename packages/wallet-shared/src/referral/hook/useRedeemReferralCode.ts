import type {
    RedeemContext,
    ReferralCodeKind,
} from "@frak-labs/backend-elysia/domain/referral-code/schemas";
import {
    type MutationOptions,
    useMutation,
    useQueryClient,
} from "@tanstack/react-query";
import { authenticatedWalletApi } from "../../common/api/backendClient";
import { referralKey } from "../queryKeys";

type RedeemInput = {
    /** 6-char referral code received from another user. */
    code: string;
    /** Set only by the onboarding step; gates a `kind='frak'` code. */
    context?: RedeemContext;
};

export type RedeemResult = {
    kind: ReferralCodeKind;
};

type UseRedeemReferralCodeProps = {
    mutations?: MutationOptions<RedeemResult, Error, RedeemInput>;
};

/**
 * Redeem a referral code for the authenticated wallet. Backend errors:
 * 400 (invalid format), 404 (code not found), 409 (already redeemed).
 *
 * Invalidates `referralKey.status` on success so any mounted status
 * consumer (settings page, onboarding gate) reflects the new redemption
 * without waiting for `useReferralStatus`'s 30s staleTime to expire.
 */
export function useRedeemReferralCode({
    mutations,
}: UseRedeemReferralCodeProps = {}) {
    const queryClient = useQueryClient();
    return useMutation({
        ...mutations,
        mutationKey: referralKey.redeem,
        mutationFn: async ({ code, context }: RedeemInput) => {
            const { data, error } =
                await authenticatedWalletApi.referral.code.redeem.post({
                    code,
                    context,
                });
            if (error) throw error;
            return data;
        },
        onSuccess: (...args) => {
            queryClient.invalidateQueries({ queryKey: referralKey.status() });
            mutations?.onSuccess?.(...args);
        },
    });
}
