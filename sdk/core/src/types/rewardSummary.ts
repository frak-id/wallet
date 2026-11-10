/**
 * Fiat value of a reward total, one figure per supported currency.
 * @category Rewards
 */
export type FiatAmounts = {
    eurAmount: number;
    usdAmount: number;
    gbpAmount: number;
};

/**
 * Rewards the current visitor earned at this merchant and has not received yet.
 * @category Rewards
 */
export type PendingRewardSummary = {
    total: FiatAmounts;
    /** Earned on the visitor's own orders. */
    cashback: FiatAmounts;
    /** Earned on purchases made by friends the visitor referred. */
    fromFriends: FiatAmounts;
    count: number;
    /** Rewards not payable yet: inside a lockup window, or held for merchant validation. */
    lockedCount: number;
    /** ISO date of the next unlock; `null` when nothing is locked. */
    nextUnlockAt: string | null;
    /** ISO date the first unpaid reward is dropped if still unclaimed; `null` when none carries a deadline. */
    expiresAt: string | null;
};

/**
 * What the visitor holds at this merchant, scoped to this merchant only.
 * @category Rewards
 */
export type RewardSummary = {
    /** The visitor's identity already belongs to a Frak wallet, so pending rewards pay out on their own. */
    linked: boolean;
    /** `null` when nothing is waiting. */
    pending: PendingRewardSummary | null;
    /** Rewards already paid at this merchant; only set once `linked`. */
    earned: { total: FiatAmounts } | null;
};
