import { and, desc, eq, isNull, lt } from "drizzle-orm";
import { db } from "../../../infrastructure/persistence/postgres";
import {
    type InteractionLogInsert,
    type InteractionLogSelect,
    interactionLogsTable,
} from "../db/schema";
import type { InteractionType } from "../types";

export class InteractionLogRepository {
    async create(log: InteractionLogInsert): Promise<InteractionLogSelect> {
        const [result] = await db
            .insert(interactionLogsTable)
            .values(log)
            .returning();
        if (!result) {
            throw new Error("Failed to create interaction log");
        }
        return result;
    }

    async findById(id: string): Promise<InteractionLogSelect | null> {
        const [result] = await db
            .select()
            .from(interactionLogsTable)
            .where(eq(interactionLogsTable.id, id))
            .limit(1);
        return result ?? null;
    }

    async findByIdentityGroup(
        identityGroupId: string,
        options?: {
            type?: InteractionType;
            limit?: number;
        }
    ): Promise<InteractionLogSelect[]> {
        const conditions = [
            eq(interactionLogsTable.identityGroupId, identityGroupId),
        ];

        if (options?.type) {
            conditions.push(eq(interactionLogsTable.type, options.type));
        }

        const query = db
            .select()
            .from(interactionLogsTable)
            .where(and(...conditions))
            .orderBy(desc(interactionLogsTable.createdAt));

        if (options?.limit) {
            return query.limit(options.limit);
        }

        return query;
    }

    async findByMerchant(
        merchantId: string,
        options?: {
            type?: InteractionType;
            limit?: number;
            onlyUnprocessed?: boolean;
        }
    ): Promise<InteractionLogSelect[]> {
        const conditions = [eq(interactionLogsTable.merchantId, merchantId)];

        if (options?.type) {
            conditions.push(eq(interactionLogsTable.type, options.type));
        }

        if (options?.onlyUnprocessed) {
            conditions.push(isNull(interactionLogsTable.processedAt));
        }

        const query = db
            .select()
            .from(interactionLogsTable)
            .where(and(...conditions))
            .orderBy(desc(interactionLogsTable.createdAt));

        if (options?.limit) {
            return query.limit(options.limit);
        }

        return query;
    }

    async findUnprocessed(limit?: number): Promise<InteractionLogSelect[]> {
        const query = db
            .select()
            .from(interactionLogsTable)
            .where(isNull(interactionLogsTable.processedAt))
            .orderBy(interactionLogsTable.createdAt);

        if (limit) {
            return query.limit(limit);
        }

        return query;
    }

    async markProcessed(id: string): Promise<InteractionLogSelect | null> {
        const [result] = await db
            .update(interactionLogsTable)
            .set({ processedAt: new Date() })
            .where(eq(interactionLogsTable.id, id))
            .returning();
        return result ?? null;
    }

    async markProcessedBatch(ids: string[]): Promise<number> {
        if (ids.length === 0) return 0;

        const results = await Promise.all(
            ids.map((id) =>
                db
                    .update(interactionLogsTable)
                    .set({ processedAt: new Date() })
                    .where(eq(interactionLogsTable.id, id))
                    .returning({ id: interactionLogsTable.id })
            )
        );

        return results.flat().length;
    }

    async countByType(
        merchantId: string,
        type: InteractionType
    ): Promise<number> {
        const results = await db
            .select({ id: interactionLogsTable.id })
            .from(interactionLogsTable)
            .where(
                and(
                    eq(interactionLogsTable.merchantId, merchantId),
                    eq(interactionLogsTable.type, type)
                )
            );
        return results.length;
    }

    async deleteOlderThan(date: Date): Promise<number> {
        const results = await db
            .delete(interactionLogsTable)
            .where(lt(interactionLogsTable.createdAt, date))
            .returning({ id: interactionLogsTable.id });
        return results.length;
    }
}
