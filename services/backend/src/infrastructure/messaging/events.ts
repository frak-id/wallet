import { EventEmitter } from "node:events";
import type { NotificationEvent } from "../../domain/notifications/events";

export type FrakEvents = {
    newInteraction: [];
    newPendingRewards: [{ count: number }];
    notification: [NotificationEvent];
};

export const eventEmitter = new EventEmitter<FrakEvents>({
    captureRejections: true,
});
