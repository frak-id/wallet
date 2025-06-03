import type { NotificationPayload } from "@frak-labs/shared/types/NotificationPayload";

/**
 * Interface representing a notification
 */
export type NotificationModel = NotificationPayload & {
    id: string;
    timestamp: number;
};
