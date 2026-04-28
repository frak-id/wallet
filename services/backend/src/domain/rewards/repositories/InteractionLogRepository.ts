import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "../../../infrastructure/persistence/postgres";
import {
    type InteractionLogInsert,
    type InteractionLogSelect,
    interactionLogsTable,
} from "../db/schema";
import type { CreateReferralLinkPayload, InteractionType } from "../types";
import { purchaseExternalEventId } from "../utils";

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
    }: {
        limit: number;
    }): Promise<InteractionLogSelect[]> {
        const conditions = [
            isNull(interactionLogsTable.processedAt),
            isNull(interactionLogsTable.cancelledAt),
            isNotNull(interactionLogsTable.identityGroupId),
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

    /**
     * Find create_referral_link interactions matching the given sharing timestamps
     * for a specific identity group and merchant.
     *
     * Uses B-tree expression index on (payload->>'sharingTimestamp')::int.
     *
     * Returns a map of sharingTimestamp → CreateReferralLinkPayload.
     */
    async findSharingInteractionsByTimestamps(params: {
        identityGroupId: string;
        merchantId: string;
        sharingTimestamps: number[];
    }): Promise<Map<number, CreateReferralLinkPayload>> {
        if (params.sharingTimestamps.length === 0) return new Map();

        const result = new Map<number, CreateReferralLinkPayload>();

        const rows = await db
            .select({
                payload: interactionLogsTable.payload,
            })
            .from(interactionLogsTable)
            .where(
                and(
                    eq(interactionLogsTable.type, "create_referral_link"),
                    eq(
                        interactionLogsTable.identityGroupId,
                        params.identityGroupId
                    ),
                    eq(interactionLogsTable.merchantId, params.merchantId),
                    inArray(
                        sql`(${interactionLogsTable.payload}->>'sharingTimestamp')::int`,
                        params.sharingTimestamps
                    )
                )
            );

        for (const row of rows) {
            const payload = row.payload as CreateReferralLinkPayload;
            if (payload.sharingTimestamp) {
                result.set(payload.sharingTimestamp, payload);
            }
        }

        return result;
    }

    /**
     * Atomically void the purchase interaction tied to an external order id
     * (e.g. when its underlying purchase is refunded/cancelled). The unique
     * `(merchantId, type, externalEventId)` index guarantees at most one row.
     *
     * Returns the affected interaction (now `cancelled_at` set), or `null` when
     * no matching interaction exists OR it was already cancelled. The caller
     * uses the returned id to cascade the cancellation to any pending rewards.
     *
     * The single UPDATE acquires a row lock that serializes against the cron's
     * `SELECT ... FOR UPDATE` in `BatchRewardOrchestrator`, so a concurrent
     * reward calculation is forced to either commit before this update
     * proceeds (then the caller cancels the freshly-inserted pending rewards)
     * or be skipped entirely once the row is marked cancelled.
     */
    async cancelPurchaseInteractionByExternalId(params: {
        merchantId: string;
        externalId: string;
    }): Promise<InteractionLogSelect | null> {
        const [row] = await db
            .update(interactionLogsTable)
            .set({ cancelledAt: new Date() })
            .where(
                and(
                    eq(interactionLogsTable.merchantId, params.merchantId),
                    eq(interactionLogsTable.type, "purchase"),
                    eq(
                        interactionLogsTable.externalEventId,
                        purchaseExternalEventId(params.externalId)
                    ),
                    isNull(interactionLogsTable.cancelledAt)
                )
            )
            .returning();
        return row ?? null;
    }
}
