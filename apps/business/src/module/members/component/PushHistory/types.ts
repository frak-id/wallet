import type { SendNotificationTargets } from "@frak-labs/backend-elysia/domain/notifications";

/** Lifecycle of a broadcast as surfaced in the history table. */
export type PushHistoryStatus = "scheduled" | "sent";

/**
 * A push broadcast projected into the row the history table renders. Derived
 * on the client from the DB-shaped `PushBroadcast` wire type (see
 * `toPushHistoryItem` in `usePushHistory`) so the backend stays presentation-free.
 */
export type PushHistoryItem = {
    id: string;
    /** Campaign name shown in the first column (the payload title). */
    title: string;
    status: PushHistoryStatus;
    /** Delivery time — scheduled time, or createdAt for immediate sends (unix-ms). */
    scheduledAt: number;
    /** Count of explicitly targeted wallets, or null for a filter audience. */
    walletCount: number | null;
    /** Delivered count, null while still scheduled. */
    sent: number | null;
    /** Opened count, null while still scheduled. */
    opened: number | null;
    payload: { title: string; body: string; icon?: string; url?: string };
    /** Audience the broadcast targets (for edit prefill). */
    target?: SendNotificationTargets;
    /** Resolved size of `target` (for edit prefill). */
    targetCount: number;
};
