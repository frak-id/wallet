import { db } from "@backend-infrastructure";
import { and, eq, inArray, isNotNull, isNull, lt } from "drizzle-orm";
import { pendingInteractionsTable } from "../db/schema";

type SelectedInteraction = typeof pendingInteractionsTable.$inferSelect;

// Auto-unlock threshold (5 minutes)
const LOCK_TIMEOUT_MS = 5 * 60 * 1000;

export class PendingInteractionsRepository {
    /**
     * Get and lock interactions to process
     * Automatically unlocks interactions locked for more than 5 minutes
     */
    async getAndLock({
        status,
        limit = 50,
        skipProcess = (arr) => arr.length === 0,
    }: {
        status: "pending" | "succeeded";
        limit?: number;
        skipProcess?: (interactions: SelectedInteraction[]) => boolean;
    }) {
        return db.transaction(async (trx) => {
            const now = new Date();
            const lockTimeoutThreshold = new Date(
                now.getTime() - LOCK_TIMEOUT_MS
            );

            // First, auto-unlock stale locks
            await trx
                .update(pendingInteractionsTable)
                .set({ lockedAt: null })
                .where(
                    and(
                        isNotNull(pendingInteractionsTable.lockedAt),
                        lt(
                            pendingInteractionsTable.lockedAt,
                            lockTimeoutThreshold
                        )
                    )
                );

            // Get all unlocked interactions with the target status
            const interactions = await trx
                .select()
                .from(pendingInteractionsTable)
                .where(
                    and(
                        eq(pendingInteractionsTable.status, status),
                        isNull(pendingInteractionsTable.lockedAt)
                    )
                )
                .limit(limit);

            if (skipProcess(interactions)) {
                return [];
            }

            // Lock them
            await trx
                .update(pendingInteractionsTable)
                .set({ lockedAt: now })
                .where(
                    inArray(
                        pendingInteractionsTable.id,
                        interactions.map((out) => out.id)
                    )
                );

            return interactions;
        });
    }

    /**
     * Unlock interactions
     */
    async unlock(interactions: SelectedInteraction[]) {
        if (interactions.length === 0) return;

        return db
            .update(pendingInteractionsTable)
            .set({ lockedAt: null })
            .where(
                inArray(
                    pendingInteractionsTable.id,
                    interactions.map((out) => out.id)
                )
            );
    }

    /**
     * Reset interactions to pending for retry (needs re-simulation)
     * Note: Only updates status - retryCount/nextRetryAt/lastRetryAt were already set by simulate job
     */
    async resetForSimulation(ids: number[]) {
        if (ids.length === 0) return;

        return db
            .update(pendingInteractionsTable)
            .set({
                status: "pending",
            })
            .where(inArray(pendingInteractionsTable.id, ids));
    }

    /**
     * Reset interactions to succeeded for retry (skip simulation, go to execution)
     * Note: Only updates status - retryCount/nextRetryAt/lastRetryAt were already set by execute job
     */
    async resetForExecution(ids: number[]) {
        if (ids.length === 0) return;

        return db
            .update(pendingInteractionsTable)
            .set({
                status: "succeeded",
            })
            .where(inArray(pendingInteractionsTable.id, ids));
    }
}
