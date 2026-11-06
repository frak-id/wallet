import type { PendingRewardSummary } from "@frak-labs/core-sdk";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Sample pending rewards for editors: both sources non-zero, twelve days left. */
export function getPreviewPending(now = Date.now()): PendingRewardSummary {
    return {
        total: { eurAmount: 12.5, usdAmount: 13.5, gbpAmount: 10.5 },
        cashback: { eurAmount: 10, usdAmount: 10.8, gbpAmount: 8.4 },
        fromFriends: { eurAmount: 2.5, usdAmount: 2.7, gbpAmount: 2.1 },
        count: 2,
        lockedCount: 0,
        nextUnlockAt: null,
        expiresAt: new Date(now + 12 * DAY_MS).toISOString(),
    };
}
