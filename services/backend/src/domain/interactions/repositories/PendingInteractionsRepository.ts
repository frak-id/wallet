import { and, eq, inArray } from "drizzle-orm";
import { db } from "infrastructure/db";
import { pendingInteractionsTable } from "../db/schema";

type SelectedInteraction = typeof pendingInteractionsTable.$inferSelect;

export class PendingInteractionsRepository {
    /**
     * Get and lock interactions to simulate depending on their status
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
            // Get all the interactions to simulate
            const interactions = await trx
                .select()
                .from(pendingInteractionsTable)
                .where(
                    and(
                        eq(pendingInteractionsTable.status, status),
                        eq(pendingInteractionsTable.locked, false)
                    )
                )
                .limit(limit);

            if (skipProcess(interactions)) {
                return [];
            }

            // Lock them
            await trx
                .update(pendingInteractionsTable)
                .set({
                    locked: true,
                })
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
     * Unlock interactions post shenanigans
     */
    async unlock(interactions: SelectedInteraction[]) {
        return db
            .update(pendingInteractionsTable)
            .set({
                locked: false,
            })
            .where(
                inArray(
                    pendingInteractionsTable.id,
                    interactions.map((out) => out.id)
                )
            );
    }
}
