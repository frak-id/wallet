import type { NotificationPayload } from "@frak-labs/ui/types/NotificationPayload";

export type NotificationModel = NotificationPayload & {
    id: string;
    timestamp: number;
};
