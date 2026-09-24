/** Owner of every `kind='frak'` code. Identical on every stage; never holds a wallet. */
export const FRAK_REFERRAL_IDENTITY_GROUP_ID =
    "00000000-0000-4000-8000-00000000f4a4";

/** A Frak code is only redeemable by an identity group younger than this. */
export const FRAK_CODE_ONBOARDING_WINDOW_MS = 24 * 60 * 60 * 1000;
