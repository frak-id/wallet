import type { FormCreatePushNotification } from "@/module/members/component/CreatePush/types";

/**
 * Lifecycle of a merchant push broadcast as surfaced in the history table.
 * `scheduled` rows have no delivery stats yet; `sent` rows expose
 * opened/sent counts.
 */
export type PushHistoryStatus = "scheduled" | "sent";

/** The composer's audience target ({ wallets } | { filter }). */
export type PushTarget = FormCreatePushNotification["target"];

/** The notification content needed to repopulate the composer on edit. */
export type PushHistoryPayload = {
    title: string;
    body: string;
    icon?: string;
    url?: string;
};

/**
 * A single push broadcast row in the history table.
 *
 * Shaped to mirror the future `notification_broadcasts` list endpoint so the
 * mock hook can be swapped for the real API without touching the UI. The
 * `payload`/`target`/`targetCount` fields are what let "Edit" reopen the
 * composer fully prefilled (see CellRowMenu).
 */
export type PushHistoryItem = {
    id: string;
    /** Internal campaign name shown in the first column. */
    title: string;
    status: PushHistoryStatus;
    /** Delivery time (or scheduled time) as a unix-millis timestamp. */
    scheduledAt: number;
    /** Audience descriptor — e.g. "All members" or "812 members". */
    audienceLabel: string;
    /** Delivered count, null while the broadcast is still scheduled. */
    sent: number | null;
    /** Opened count, null while the broadcast is still scheduled. */
    opened: number | null;
    /** Notification content shown to members (for edit prefill). */
    payload: PushHistoryPayload;
    /** Audience the broadcast was sent to (for edit prefill). */
    target?: PushTarget;
    /** Resolved size of `target` (for edit prefill). */
    targetCount: number;
};
