const REFERRAL_CODE_PATTERN = /^[A-Z0-9]{6}$/;

/** Normalises a referral code from a URL; `undefined` when it is not a 6-char alphanumeric. */
export function parseReferralCode(raw: unknown): string | undefined {
    if (typeof raw !== "string") return undefined;
    const upper = raw.toUpperCase();
    return REFERRAL_CODE_PATTERN.test(upper) ? upper : undefined;
}
