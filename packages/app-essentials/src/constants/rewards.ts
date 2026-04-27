/**
 * Constants shared between the backend, the dashboard, and the wallet for
 * reward lifecycle management.
 *
 * Lockup window — the grace period during which a reward stays `pending`
 * after a purchase. Refunds during this window cancel the reward and restore
 * the campaign budget.
 */
export const REWARD_LOCKUP = {
    /** Default lockup applied to new campaigns. */
    DEFAULT_DAYS: 14,
    /** Lower bound (0 disables the lockup). */
    MIN_DAYS: 0,
    /** Upper bound — kept conservative so a typo can't lock funds for years. */
    MAX_DAYS: 30,
    /** Seconds equivalent of MAX_DAYS — used for backend schema validation. */
    MAX_SECONDS: 30 * 86_400,
    /** Seconds in a day — used to convert dashboard `days` to backend `seconds`. */
    SECONDS_PER_DAY: 86_400,
} as const;
