import {
    and,
    count,
    desc,
    eq,
    getTableColumns,
    inArray,
    sql,
} from "drizzle-orm";
import type { Address } from "viem";
import { db } from "../../../infrastructure/persistence/postgres";
import {
    type NotificationSentInsert,
    type NotificationSentWithStatus,
    type NotificationStatus,
    type NotificationType,
    notificationSentTable,
} from "../db/schema";

export class NotificationSentRepository {
    async insertBatch(
        records: Omit<NotificationSentInsert, "id" | "sentAt">[]
    ): Promise<NotificationSentWithStatus[]> {
        if (records.length === 0) return [];
        const rows = await db
            .insert(notificationSentTable)
            .values(records)
            .returning();
        return rows.map((row) => ({
            ...row,
            status: (row.openedAt ? "opened" : "sent") as NotificationStatus,
        }));
    }

    async findByWallet(
        wallet: Address,
        options?: {
            limit?: number;
            offset?: number;
            types?: NotificationType[];
        }
    ): Promise<NotificationSentWithStatus[]> {
        const conditions = [eq(notificationSentTable.wallet, wallet)];

        if (options?.types && options.types.length > 0) {
            conditions.push(inArray(notificationSentTable.type, options.types));
        }

        const query = db
            .select({
                ...getTableColumns(notificationSentTable),
                status: sql<NotificationStatus>`CASE WHEN ${notificationSentTable.openedAt} IS NOT NULL THEN 'opened' ELSE 'sent' END`,
            })
            .from(notificationSentTable)
            .where(and(...conditions))
            .orderBy(desc(notificationSentTable.sentAt));

        if (options?.limit) {
            query.limit(options.limit);
        }
        if (options?.offset) {
            query.offset(options.offset);
        }

        return query;
    }

    async markOpened(id: string, wallet: Address): Promise<boolean> {
        const results = await db
            .update(notificationSentTable)
            .set({
                openedAt: new Date(),
            })
            .where(
                and(
                    eq(notificationSentTable.id, id),
                    eq(notificationSentTable.wallet, wallet)
                )
            )
            .returning({ id: notificationSentTable.id });

        return results.length > 0;
    }

    async countByBroadcast(
        broadcastId: string
    ): Promise<{ sent: number; opened: number }> {
        const [result] = await db
            .select({
                sent: count(),
                opened: count(notificationSentTable.openedAt),
            })
            .from(notificationSentTable)
            .where(eq(notificationSentTable.broadcastId, broadcastId));

        return {
            sent: result?.sent ?? 0,
            opened: result?.opened ?? 0,
        };
    }

    async countByBroadcasts(
        broadcastIds: string[]
    ): Promise<Map<string, { sent: number; opened: number }>> {
        if (broadcastIds.length === 0) return new Map();

        const results = await db
            .select({
                broadcastId: notificationSentTable.broadcastId,
                sent: count(),
                opened: sql<number>`count(${notificationSentTable.openedAt})::int`,
            })
            .from(notificationSentTable)
            .where(inArray(notificationSentTable.broadcastId, broadcastIds))
            .groupBy(notificationSentTable.broadcastId);

        const map = new Map<string, { sent: number; opened: number }>();
        for (const row of results) {
            if (row.broadcastId) {
                map.set(row.broadcastId, {
                    sent: row.sent,
                    opened: row.opened,
                });
            }
        }
        return map;
    }
}
