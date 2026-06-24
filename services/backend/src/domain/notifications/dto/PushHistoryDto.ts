import { t } from "@backend-utils";
import type { Static } from "elysia";
import { SendNotificationTargetsDto } from "./SendNotificationDto";

/**
 * Lifecycle of a broadcast as surfaced in the dashboard history table:
 * `scheduled` rows have a future delivery the cron hasn't claimed yet and carry
 * no stats; everything else is `sent`.
 */
export const PushHistoryStatusSchema = t.Union([
    t.Literal("scheduled"),
    t.Literal("sent"),
]);

/** Notification content needed to repopulate the composer on edit. */
export const PushHistoryPayloadSchema = t.Object({
    title: t.String(),
    body: t.String(),
    icon: t.Optional(t.String()),
    url: t.Optional(t.String()),
});

/**
 * A single push broadcast row returned by `GET /business/notifications/broadcasts`.
 * Shared with the dashboard (imported as the table's `PushHistoryItem`) so the
 * wire contract has a single source of truth.
 */
export const PushHistoryItemSchema = t.Object({
    id: t.String(),
    /** Internal campaign name shown in the first column (the payload title). */
    title: t.String(),
    status: PushHistoryStatusSchema,
    /** Delivery time (or scheduled time) as a unix-millis timestamp. */
    scheduledAt: t.Number(),
    /** Audience descriptor — e.g. "All members" or "812 members". */
    audienceLabel: t.String(),
    /** Delivered count, null while the broadcast is still scheduled. */
    sent: t.Union([t.Number(), t.Null()]),
    /** Opened count, null while the broadcast is still scheduled. */
    opened: t.Union([t.Number(), t.Null()]),
    payload: PushHistoryPayloadSchema,
    /** Audience the broadcast targets (for edit prefill). */
    target: t.Optional(SendNotificationTargetsDto),
    /** Resolved size of `target` (for edit prefill). */
    targetCount: t.Number(),
});

export type PushHistoryStatus = Static<typeof PushHistoryStatusSchema>;
export type PushHistoryPayload = Static<typeof PushHistoryPayloadSchema>;
export type PushHistoryItem = Static<typeof PushHistoryItemSchema>;
