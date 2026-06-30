import { t } from "@backend-utils";
import type { Static } from "elysia";
import {
    SendNotificationPayloadDto,
    SendNotificationTargetsDto,
} from "./SendNotificationDto";

/**
 * A push broadcast row returned by `GET /business/notifications/broadcasts`,
 * shaped close to the DB so the dashboard owns all presentation mapping
 * (status, audience label, stats formatting, edit prefill). Timestamps are
 * unix-millis; `targets` is null for immediate broadcasts and
 * `scheduledAt`/`claimedAt` are null outside the scheduled-queue lifecycle.
 */
export const PushBroadcastSchema = t.Object({
    id: t.String(),
    payload: SendNotificationPayloadDto,
    targets: t.Union([SendNotificationTargetsDto, t.Null()]),
    scheduledAt: t.Union([t.Number(), t.Null()]),
    claimedAt: t.Union([t.Number(), t.Null()]),
    createdAt: t.Number(),
    sentCount: t.Number(),
    openedCount: t.Number(),
});

export type PushBroadcast = Static<typeof PushBroadcastSchema>;
