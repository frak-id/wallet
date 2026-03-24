import { and, desc, eq, getTableColumns, inArray, sql } from "drizzle-orm";
import type { Address } from "viem";
import { db } from "../../../infrastructure/persistence/postgres";
import {
    type NotificationSentInsert,
    type NotificationSentWithStatus,
    notificationSentTable,
} from "../db/schema";
import type { NotificationStatus, NotificationType } from "../schemas";

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
}
