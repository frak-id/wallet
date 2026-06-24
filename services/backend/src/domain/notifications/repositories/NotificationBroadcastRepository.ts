import { db } from "@backend-infrastructure";
import { and, desc, eq, isNotNull, isNull, lte, sql } from "drizzle-orm";
import {
    type NotificationBroadcastSelect,
    notificationBroadcastsTable,
    notificationSentTable,
} from "../db/schema";
import type {
    SendNotificationPayload,
    SendNotificationTargets,
} from "../dto/SendNotificationDto";

/**
 * A broadcast row enriched with delivery stats aggregated from
 * `notification_sent` (`sentCount`/`openedCount` are 0 for broadcasts that
 * haven't been delivered yet, e.g. pending scheduled ones).
 */
export type BroadcastWithStats = NotificationBroadcastSelect & {
    sentCount: number;
    openedCount: number;
};

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

    /**
     * List every broadcast for a merchant (immediate, scheduled and delivered),
     * newest first, with delivery stats joined from `notification_sent`. Powers
     * the dashboard push-history table.
     */
    async listBroadcasts(merchantId: string): Promise<BroadcastWithStats[]> {
        return db
            .select({
                id: notificationBroadcastsTable.id,
                merchantId: notificationBroadcastsTable.merchantId,
                payload: notificationBroadcastsTable.payload,
                targets: notificationBroadcastsTable.targets,
                scheduledAt: notificationBroadcastsTable.scheduledAt,
                claimedAt: notificationBroadcastsTable.claimedAt,
                createdAt: notificationBroadcastsTable.createdAt,
                sentCount: sql<number>`count(${notificationSentTable.id})::int`,
                openedCount: sql<number>`count(${notificationSentTable.openedAt})::int`,
            })
            .from(notificationBroadcastsTable)
            .leftJoin(
                notificationSentTable,
                eq(
                    notificationSentTable.broadcastId,
                    notificationBroadcastsTable.id
                )
            )
            .where(eq(notificationBroadcastsTable.merchantId, merchantId))
            .groupBy(notificationBroadcastsTable.id)
            .orderBy(desc(notificationBroadcastsTable.createdAt));
    }

    /**
     * Delete any broadcast (scheduled or already delivered) owned by the
     * merchant. Returns false when nothing matched so the route can 404.
     */
    async deleteBroadcast(id: string, merchantId: string): Promise<boolean> {
        const results = await db
            .delete(notificationBroadcastsTable)
            .where(
                and(
                    eq(notificationBroadcastsTable.id, id),
                    eq(notificationBroadcastsTable.merchantId, merchantId)
                )
            )
            .returning({ id: notificationBroadcastsTable.id });
        return results.length > 0;
    }

    /**
     * Update a still-pending scheduled broadcast (content, audience and/or
     * delivery time). Guarded to unclaimed scheduled rows so the cron can't be
     * raced and immediate broadcasts can't be mutated. Returns false when
     * nothing matched so the route can 404.
     */
    async updateScheduled(
        id: string,
        merchantId: string,
        params: {
            payload: SendNotificationPayload;
            targets?: SendNotificationTargets;
            scheduledAt: Date;
        }
    ): Promise<boolean> {
        const results = await db
            .update(notificationBroadcastsTable)
            .set({
                payload: params.payload,
                targets: params.targets,
                scheduledAt: params.scheduledAt,
            })
            .where(
                and(
                    eq(notificationBroadcastsTable.id, id),
                    eq(notificationBroadcastsTable.merchantId, merchantId),
                    isNotNull(notificationBroadcastsTable.scheduledAt),
                    isNull(notificationBroadcastsTable.claimedAt)
                )
            )
            .returning({ id: notificationBroadcastsTable.id });
        return results.length > 0;
    }

    /**
     * Atomically claim every due scheduled broadcast by stamping `claimedAt`.
     * The UPDATE ... RETURNING runs under row locks, so concurrent replicas
     * each receive a disjoint set of rows — no double-send without an external lock.
     */
    async claimDueScheduled(now: Date): Promise<NotificationBroadcastSelect[]> {
        return db
            .update(notificationBroadcastsTable)
            .set({ claimedAt: now })
            .where(
                and(
                    isNotNull(notificationBroadcastsTable.scheduledAt),
                    isNull(notificationBroadcastsTable.claimedAt),
                    lte(notificationBroadcastsTable.scheduledAt, now)
                )
            )
            .returning();
    }
}
