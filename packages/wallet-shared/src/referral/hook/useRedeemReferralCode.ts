import type {
    GameSummary,
    InviteRewards,
} from "@frak-labs/backend-elysia/domain/game/schemas";
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
    /** Accepts losing the welcome bonus when Frak holds the referrer slot (409 `FRAK_REFERRER`). */
    replaceFrakReferrer?: boolean;
};

export type RedeemResult = {
    kind: ReferralCodeKind;
    /** The game joined: its own code, or the current open game on a friend's signup. */
    game?: GameSummary;
    /** The Frak Game reward queued by this call, in EURe. */
    gameReward?: number;
    /** The caller's Frak Game signup reward, in EURe. */
    signupReward?: number;
    /** What each side earns per friend's signup, in EURe. */
    inviteRewards?: InviteRewards;
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
        mutationFn: async ({
            code,
            context,
            replaceFrakReferrer,
        }: RedeemInput) => {
            const { data, error } =
                await authenticatedWalletApi.referral.code.redeem.post({
                    code,
                    context,
                    replaceFrakReferrer,
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
