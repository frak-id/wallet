import type { NotificationPayload } from "@/context/notification/action/sendPush";

/**
 * Interface representing a notification
 */
export type NotificationModel = NotificationPayload & {
    id: string;
    timestamp: number;
};
