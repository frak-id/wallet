import { db } from "@backend-infrastructure";
import {
    type NotificationBroadcastSelect,
    notificationBroadcastsTable,
} from "../db/schema";
import type { SendNotificationPayload } from "../dto/SendNotificationDto";

export class NotificationBroadcastRepository {
    async create(params: {
        merchantId: string;
        payload: SendNotificationPayload;
    }): Promise<NotificationBroadcastSelect> {
        const [result] = await db
            .insert(notificationBroadcastsTable)
            .values(params)
            .returning();
        return result;
    }
}
