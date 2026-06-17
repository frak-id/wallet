import { db } from "@backend-infrastructure";
import { and, asc, eq, isNotNull, isNull, lte } from "drizzle-orm";
import {
    type NotificationBroadcastSelect,
    notificationBroadcastsTable,
} from "../db/schema";
import type {
    SendNotificationPayload,
    SendNotificationTargets,
} from "../dto/SendNotificationDto";

export type ScheduledBroadcastSelect = Pick<
    NotificationBroadcastSelect,
    "id" | "payload" | "targets" | "scheduledAt" | "createdAt"
>;

export class NotificationBroadcastRepository {
    async create(params: {
        merchantId: string;
        payload: SendNotificationPayload;
        targets?: SendNotificationTargets;
        scheduledAt?: Date;
    }): Promise<NotificationBroadcastSelect> {
        const [result] = await db
            .insert(notificationBroadcastsTable)
            .values(params)
            .returning();
        return result;
    }

    async listScheduled(
        merchantId: string
    ): Promise<ScheduledBroadcastSelect[]> {
        return db
            .select({
                id: notificationBroadcastsTable.id,
                payload: notificationBroadcastsTable.payload,
                targets: notificationBroadcastsTable.targets,
                scheduledAt: notificationBroadcastsTable.scheduledAt,
                createdAt: notificationBroadcastsTable.createdAt,
            })
            .from(notificationBroadcastsTable)
            .where(
                and(
                    eq(notificationBroadcastsTable.merchantId, merchantId),
                    isNotNull(notificationBroadcastsTable.scheduledAt),
                    isNull(notificationBroadcastsTable.sentAt)
                )
            )
            .orderBy(asc(notificationBroadcastsTable.scheduledAt));
    }

    async deleteScheduled(id: string, merchantId: string): Promise<boolean> {
        const results = await db
            .delete(notificationBroadcastsTable)
            .where(
                and(
                    eq(notificationBroadcastsTable.id, id),
                    eq(notificationBroadcastsTable.merchantId, merchantId),
                    isNotNull(notificationBroadcastsTable.scheduledAt),
                    isNull(notificationBroadcastsTable.sentAt)
                )
            )
            .returning({ id: notificationBroadcastsTable.id });
        return results.length > 0;
    }

    /**
     * Atomically claim every due scheduled broadcast by stamping `sentAt`.
     * The UPDATE ... RETURNING runs under row locks, so concurrent replicas
     * each receive a disjoint set of rows — no double-send without an external lock.
     */
    async claimDueScheduled(now: Date): Promise<NotificationBroadcastSelect[]> {
        return db
            .update(notificationBroadcastsTable)
            .set({ sentAt: now })
            .where(
                and(
                    isNotNull(notificationBroadcastsTable.scheduledAt),
                    isNull(notificationBroadcastsTable.sentAt),
                    lte(notificationBroadcastsTable.scheduledAt, now)
                )
            )
            .returning();
    }
}
