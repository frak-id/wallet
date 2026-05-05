/**
 * Query / mutation keys for the referral feature
 */
export namespace referralKey {
    const base = "referral" as const;

    /**
     * Global referral status (owned code + has-been-referred flags)
     * for the authenticated wallet, optionally scoped to a merchant.
     */
    export const status = (merchantId?: string) =>
        [base, "status", merchantId ?? null] as const;

    /**
     * Issue a new referral code (with or without a preferred 6-char value).
     */
    export const issue = [base, "code", "issue"] as const;

    /**
     * Suggest 6-char codes from a 3-4 char stem.
     */
    export const suggest = [base, "code", "suggest"] as const;

    /**
     * Redeem a 6-char referral code received from another user.
     */
    export const redeem = [base, "code", "redeem"] as const;

    /**
     * Revoke the authenticated wallet's active referral code.
     */
    export const revoke = [base, "code", "revoke"] as const;

    /**
     * Rotate the authenticated wallet's active referral code (revoke
     * the old one, then issue the new one).
     */
    export const replace = [base, "code", "replace"] as const;

    /**
     * Remove the authenticated wallet's active cross-merchant referrer
     * (created by redeeming someone else's code).
     */
    export const unredeem = [base, "redemption", "delete"] as const;
}
