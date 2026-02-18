import { and, inArray, isNotNull, isNull, lt, sql } from "drizzle-orm";
import { db } from "../../../infrastructure/persistence/postgres";
import {
    type InteractionLogInsert,
    type InteractionLogSelect,
    interactionLogsTable,
} from "../db/schema";
import type { InteractionType } from "../types";

export class InteractionLogRepository {
    async createIdempotent(
        log: InteractionLogInsert & { externalEventId: string }
    ): Promise<InteractionLogSelect | null> {
        const [result] = await db
            .insert(interactionLogsTable)
            .values(log)
            .onConflictDoNothing({
                target: [
                    interactionLogsTable.merchantId,
                    interactionLogsTable.type,
                    interactionLogsTable.externalEventId,
                ],
            })
            .returning();
        return result ?? null;
    }

    async findUnprocessedForRewards({
        limit,
        minAgeSeconds,
    }: {
        limit: number;
        minAgeSeconds: number;
    }): Promise<InteractionLogSelect[]> {
        const minAgeThreshold = sql`NOW() - INTERVAL '${sql.raw(minAgeSeconds.toString())} seconds'`;

        const conditions = [
            isNull(interactionLogsTable.processedAt),
            isNotNull(interactionLogsTable.identityGroupId),
            lt(interactionLogsTable.createdAt, minAgeThreshold),
        ];

        return db
            .select()
            .from(interactionLogsTable)
            .where(and(...conditions))
            .orderBy(interactionLogsTable.createdAt)
            .limit(limit);
    }

    async getTypesByIds(ids: string[]): Promise<Map<string, InteractionType>> {
        if (ids.length === 0) return new Map();

        const rows = await db
            .select({
                id: interactionLogsTable.id,
                type: interactionLogsTable.type,
            })
            .from(interactionLogsTable)
            .where(inArray(interactionLogsTable.id, ids));

        return new Map(rows.map((r) => [r.id, r.type]));
    }

    async markProcessedBatch(ids: string[]): Promise<number> {
        if (ids.length === 0) return 0;

        const results = await db
            .update(interactionLogsTable)
            .set({ processedAt: new Date() })
            .where(inArray(interactionLogsTable.id, ids))
            .returning({ id: interactionLogsTable.id });

        return results.length;
    }
}
