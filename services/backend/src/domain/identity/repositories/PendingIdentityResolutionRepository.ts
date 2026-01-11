import { and, desc, eq, inArray, lt, sql } from "drizzle-orm";
import type { Address, Hex } from "viem";
import { db } from "../../../infrastructure/persistence/postgres";
import {
    type IdentityResolutionStatus,
    type PendingIdentityResolutionInsert,
    type PendingIdentityResolutionSelect,
    pendingIdentityResolutionsTable,
} from "../db/schema";

const MAX_ATTEMPTS = 5;

type QueueParams = {
    groupId: string;
    walletAddress: Address;
};

type OnchainResult = {
    txHash: Hex;
    blockNumber: bigint;
};

export class PendingIdentityResolutionRepository {
    async queueBatch(
        params: QueueParams[]
    ): Promise<PendingIdentityResolutionSelect[]> {
        if (params.length === 0) return [];

        const inserts: PendingIdentityResolutionInsert[] = params.map((p) => ({
            groupId: p.groupId,
            walletAddress: p.walletAddress,
            status: "pending" as const,
            attempts: 0,
        }));

        return db
            .insert(pendingIdentityResolutionsTable)
            .values(inserts)
            .returning();
    }

    async findPendingForProcessing(
        limit: number
    ): Promise<PendingIdentityResolutionSelect[]> {
        return db
            .select()
            .from(pendingIdentityResolutionsTable)
            .where(
                and(
                    eq(pendingIdentityResolutionsTable.status, "pending"),
                    lt(pendingIdentityResolutionsTable.attempts, MAX_ATTEMPTS)
                )
            )
            .orderBy(pendingIdentityResolutionsTable.createdAt)
            .limit(limit);
    }

    async markProcessing(ids: string[]): Promise<number> {
        if (ids.length === 0) return 0;

        const results = await db
            .update(pendingIdentityResolutionsTable)
            .set({
                status: "processing",
                attempts: sql`${pendingIdentityResolutionsTable.attempts} + 1`,
            })
            .where(inArray(pendingIdentityResolutionsTable.id, ids))
            .returning({ id: pendingIdentityResolutionsTable.id });

        return results.length;
    }

    async markCompleted(
        ids: string[],
        onchainData: OnchainResult
    ): Promise<number> {
        if (ids.length === 0) return 0;

        const results = await db
            .update(pendingIdentityResolutionsTable)
            .set({
                status: "completed",
                processedAt: new Date(),
                onchainTxHash: onchainData.txHash,
                onchainBlock: onchainData.blockNumber.toString(),
            })
            .where(inArray(pendingIdentityResolutionsTable.id, ids))
            .returning({ id: pendingIdentityResolutionsTable.id });

        return results.length;
    }

    async markFailed(ids: string[], error: string): Promise<number> {
        if (ids.length === 0) return 0;

        const results = await db
            .update(pendingIdentityResolutionsTable)
            .set({
                status: "failed",
                lastError: error,
                processedAt: new Date(),
            })
            .where(inArray(pendingIdentityResolutionsTable.id, ids))
            .returning({ id: pendingIdentityResolutionsTable.id });

        return results.length;
    }

    async resetStuckProcessing(olderThanMinutes: number): Promise<number> {
        const cutoff = new Date(Date.now() - olderThanMinutes * 60 * 1000);

        const results = await db
            .update(pendingIdentityResolutionsTable)
            .set({
                status: "pending",
            })
            .where(
                and(
                    eq(pendingIdentityResolutionsTable.status, "processing"),
                    lt(pendingIdentityResolutionsTable.createdAt, cutoff)
                )
            )
            .returning({ id: pendingIdentityResolutionsTable.id });

        return results.length;
    }

    async revertToPending(ids: string[]): Promise<number> {
        if (ids.length === 0) return 0;

        const results = await db
            .update(pendingIdentityResolutionsTable)
            .set({
                status: "pending",
            })
            .where(inArray(pendingIdentityResolutionsTable.id, ids))
            .returning({ id: pendingIdentityResolutionsTable.id });

        return results.length;
    }

    async countByStatus(): Promise<Record<IdentityResolutionStatus, number>> {
        const results = await db
            .select({
                status: pendingIdentityResolutionsTable.status,
                count: sql<number>`count(*)::int`,
            })
            .from(pendingIdentityResolutionsTable)
            .groupBy(pendingIdentityResolutionsTable.status);

        const counts: Record<IdentityResolutionStatus, number> = {
            pending: 0,
            processing: 0,
            completed: 0,
            failed: 0,
        };

        for (const row of results) {
            counts[row.status] = row.count;
        }

        return counts;
    }

    async findRecent(
        limit: number
    ): Promise<PendingIdentityResolutionSelect[]> {
        return db
            .select()
            .from(pendingIdentityResolutionsTable)
            .orderBy(desc(pendingIdentityResolutionsTable.createdAt))
            .limit(limit);
    }
}
