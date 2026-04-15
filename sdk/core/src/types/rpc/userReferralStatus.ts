/**
 * User referral status returned by `frak_getUserReferralStatus`.
 *
 * Generic referral context for the current user on a merchant.
 * Used by components like `<frak-post-purchase>` and `<frak-referred-banner>`
 * to adapt their display based on the user's referral relationship.
 *
 * Returns `null` when the user's identity cannot be resolved
 * (e.g. no clientId and no wallet session).
 *
 * @group RPC Schema
 */
export type UserReferralStatusType = {
    /**
     * Whether the user was referred to this merchant by someone else.
     *
     * `true` means a referral link exists where this user is the referee.
     */
    isReferred: boolean;
};
