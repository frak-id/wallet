import { desc, eq } from "drizzle-orm";
import { db } from "../../../infrastructure/persistence/postgres";
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

    async findByMerchant(
        merchantId: string,
        options?: { limit?: number; offset?: number }
    ): Promise<NotificationBroadcastSelect[]> {
        const query = db
            .select()
            .from(notificationBroadcastsTable)
            .where(eq(notificationBroadcastsTable.merchantId, merchantId))
            .orderBy(desc(notificationBroadcastsTable.createdAt));

        if (options?.limit) {
            query.limit(options.limit);
        }
        if (options?.offset) {
            query.offset(options.offset);
        }

        return query;
    }

    async findById(
        id: string
    ): Promise<NotificationBroadcastSelect | undefined> {
        return db.query.notificationBroadcastsTable.findFirst({
            where: eq(notificationBroadcastsTable.id, id),
        });
    }
}
