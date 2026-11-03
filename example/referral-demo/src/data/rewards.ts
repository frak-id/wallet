/**
 * The merchant's referral campaign. Léa (referrer) earns once a friend buys
 * through her link; Chloé (referee) earns on her own first purchase.
 */
export const campaign = {
    referrerReward: 10,
    refereeReward: 5,
    /** Days the brand keeps a reward pending before it can be collected. */
    validationDays: 14,
} as const;

/** The evening the demo tells: Léa orders and posts her story, Chloé buys about two hours later. */
export const clock = {
    lea: "19:24",
    chloe: "21:31",
} as const;
