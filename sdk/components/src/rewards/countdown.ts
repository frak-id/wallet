import { isIOS } from "@frak-labs/core-sdk";

const DAY_MS = 24 * 60 * 60 * 1000;

/** WebKit erases script-written storage, client id and key included, after 7 days without a tap on the site. */
export const WEBKIT_STORAGE_DAYS = 7;

/** Safari, and every iOS browser or web view, since all of them run WebKit's tracking prevention. */
export function isStorageCappedBrowser(
    userAgent: string = typeof navigator === "undefined"
        ? ""
        : navigator.userAgent,
    ios: boolean = isIOS
): boolean {
    if (ios) return true;
    return (
        /AppleWebKit/i.test(userAgent) &&
        !/(Chrome|Chromium|CriOS|Edg|OPR|Android)/i.test(userAgent)
    );
}

/** Days between local calendar dates, so the count agrees with the date shown beside it. */
function calendarDaysUntil(deadline: number, now: number): number {
    const dayOf = (ms: number) => {
        const date = new Date(ms);
        return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
    };
    return Math.max(0, Math.round((dayOf(deadline) - dayOf(now)) / DAY_MS));
}

export type RewardCountdown = {
    /** Calendar days to the deadline's date: 0 on its last day and once it has passed. */
    days: number;
    /** The day the countdown points at, for `{DATE}`. */
    date: Date;
};

/**
 * Countdown shown with an unclaimed reward. On WebKit it never exceeds 7 days, even
 * without a deadline, since the visitor's storage would not outlive it; elsewhere a
 * reward without a deadline gets no countdown.
 */
export function getRewardCountdown(
    expiresAt: string | null,
    {
        now = Date.now(),
        capped = isStorageCappedBrowser(),
    }: { now?: number; capped?: boolean } = {}
): RewardCountdown | undefined {
    const deadline = expiresAt ? Date.parse(expiresAt) : Number.NaN;
    const hasDeadline = Number.isFinite(deadline);
    const days = hasDeadline ? calendarDaysUntil(deadline, now) : undefined;

    if (!capped) {
        return days === undefined
            ? undefined
            : { days, date: new Date(deadline) };
    }
    if (days !== undefined && days <= WEBKIT_STORAGE_DAYS) {
        return { days, date: new Date(deadline) };
    }
    return {
        days: WEBKIT_STORAGE_DAYS,
        date: new Date(now + WEBKIT_STORAGE_DAYS * DAY_MS),
    };
}
