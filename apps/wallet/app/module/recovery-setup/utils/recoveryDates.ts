import { isRunningInProd } from "@frak-labs/app-essentials";

const SECONDS_PER_DAY = 60 * 60 * 24;
const ONE_WEEK_SECONDS = SECONDS_PER_DAY * 7;
const TWO_MONTHS_SECONDS = SECONDS_PER_DAY * 60;
const TWO_YEARS_SECONDS = SECONDS_PER_DAY * 365 * 2;

function nowSeconds(): number {
    return Math.floor(Date.now() / 1000);
}

/**
 * Default security delay before a recovery can be executed (`validAfter`): one
 * week in production so a stolen backup can't be used immediately. No delay in
 * dev to keep local testing fast.
 */
export function defaultValidAfter(): number {
    return isRunningInProd ? nowSeconds() + ONE_WEEK_SECONDS : nowSeconds();
}

/** Latest allowed expiry (`validUntil`), also used as the default: two years out. */
export function maxValidUntil(): number {
    return nowSeconds() + TWO_YEARS_SECONDS;
}

export function dateToValidAfter(date: Date | undefined): number {
    if (!date) {
        return defaultValidAfter();
    }
    return Math.floor(date.getTime() / 1000);
}

export function dateToValidUntil(date: Date | undefined): number {
    const max = maxValidUntil();
    if (!date) {
        return max;
    }
    return Math.min(Math.floor(date.getTime() / 1000), max);
}

/**
 * Whether a recovery should be refreshed soon. `validUntil === 0` means "never
 * expires", so it is never considered expiring.
 */
export function isExpiringSoon(validUntil: number): boolean {
    if (!validUntil) {
        return false;
    }
    return validUntil - nowSeconds() < TWO_MONTHS_SECONDS;
}
