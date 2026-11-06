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

/**
 * Whole days left before unclaimed rewards expire, or `undefined` for no countdown.
 * Capped at 7 on WebKit, where no deadline still means 7.
 */
export function getRewardDaysLeft(
    expiresAt: string | null,
    now = Date.now()
): number | undefined {
    const deadline = expiresAt ? Date.parse(expiresAt) : Number.NaN;
    const days = Number.isFinite(deadline)
        ? Math.max(0, Math.ceil((deadline - now) / DAY_MS))
        : undefined;

    if (!isStorageCappedBrowser()) return days;
    return days === undefined
        ? WEBKIT_STORAGE_DAYS
        : Math.min(days, WEBKIT_STORAGE_DAYS);
}
