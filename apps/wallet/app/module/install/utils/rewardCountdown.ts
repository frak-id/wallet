import { isIOS } from "@frak-labs/core-sdk";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Safari and iOS wipe a visitor's script-written storage after 7 days without interaction. */
const WEBKIT_STORAGE_DAYS = 7;

function isStorageCappedBrowser(): boolean {
    if (isIOS) return true;
    const userAgent = navigator.userAgent;
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

/**
 * Calendar days left before unclaimed rewards expire (0 on the last day), or `undefined` for no countdown.
 * Capped at 7 on WebKit, where no deadline still means 7.
 */
export function getRewardDaysLeft(
    expiresAt: string | null,
    now = Date.now()
): number | undefined {
    const deadline = expiresAt ? Date.parse(expiresAt) : Number.NaN;
    const days = Number.isFinite(deadline)
        ? calendarDaysUntil(deadline, now)
        : undefined;

    if (!isStorageCappedBrowser()) return days;
    return days === undefined
        ? WEBKIT_STORAGE_DAYS
        : Math.min(days, WEBKIT_STORAGE_DAYS);
}
