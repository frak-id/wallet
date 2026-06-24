import type {
    PushHistoryItem as ApiPushHistoryItem,
    PushHistoryPayload as ApiPushHistoryPayload,
    PushHistoryStatus as ApiPushHistoryStatus,
} from "@frak-labs/backend-elysia/domain/notifications";

/**
 * Push-history table types. These are re-exported straight from the backend's
 * typebox schema (`GET /business/notifications/broadcasts` response) so the UI
 * and the API stay on a single source of truth — see
 * `domain/notifications/dto/PushHistoryDto` on the backend.
 */
export type PushHistoryStatus = ApiPushHistoryStatus;
export type PushHistoryPayload = ApiPushHistoryPayload;
export type PushHistoryItem = ApiPushHistoryItem;

/** The composer's audience target ({ wallets } | { filter }). */
export type PushTarget = PushHistoryItem["target"];
