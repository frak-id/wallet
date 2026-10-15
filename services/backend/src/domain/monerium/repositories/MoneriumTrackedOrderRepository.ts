import { db } from "@backend-infrastructure";
import type { MoneriumOrderState } from "@frak-labs/app-essentials/monerium";
import { and, eq, inArray } from "drizzle-orm";
import type { Address } from "viem";
import {
    type MoneriumTrackedOrderRow,
    moneriumTrackedOrdersTable,
} from "../db/schema";
import { dueWithBackoff, oldestCheckFirst, type RecheckTier } from "./dueTiers";

export class MoneriumTrackedOrderRepository {
    async findById(id: string): Promise<MoneriumTrackedOrderRow | undefined> {
        const [row] = await db
            .select()
            .from(moneriumTrackedOrdersTable)
            .where(eq(moneriumTrackedOrdersTable.id, id))
            .limit(1);
        return row;
    }

    /** True when this call created the row, false when the id was already tracked. */
    async insertIfAbsent(params: {
        id: string;
        wallet: Address;
        amount: string;
        state: MoneriumOrderState;
    }): Promise<boolean> {
        const inserted = await db
            .insert(moneriumTrackedOrdersTable)
            .values(params)
            .onConflictDoNothing()
            .returning({ id: moneriumTrackedOrdersTable.id });
        return inserted.length > 0;
    }

    async markPlacementAccepted(id: string): Promise<void> {
        await db
            .update(moneriumTrackedOrdersTable)
            .set({ placementAccepted: true })
            .where(eq(moneriumTrackedOrdersTable.id, id));
    }

    async deleteById(id: string): Promise<void> {
        await db
            .delete(moneriumTrackedOrdersTable)
            .where(eq(moneriumTrackedOrdersTable.id, id));
    }

    async deleteByWallet(wallet: Address): Promise<void> {
        await db
            .delete(moneriumTrackedOrdersTable)
            .where(eq(moneriumTrackedOrdersTable.wallet, wallet));
    }

    /**
     * Moves the order to `to` only while it is still in `from`, so a transition seen
     * by several pods is applied (and notified) once. Returns whether this call won.
     */
    async transition(
        id: string,
        from: MoneriumOrderState,
        to: MoneriumOrderState
    ): Promise<boolean> {
        const updated = await db
            .update(moneriumTrackedOrdersTable)
            .set({
                state: to,
                lastCheckedAt: new Date(),
                updatedAt: new Date(),
            })
            .where(
                and(
                    eq(moneriumTrackedOrdersTable.id, id),
                    eq(moneriumTrackedOrdersTable.state, from)
                )
            )
            .returning({ id: moneriumTrackedOrdersTable.id });
        return updated.length > 0;
    }

    async markChecked(id: string): Promise<void> {
        await db
            .update(moneriumTrackedOrdersTable)
            .set({ lastCheckedAt: new Date() })
            .where(eq(moneriumTrackedOrdersTable.id, id));
    }

    /** Claims in-flight orders: `last_checked_at` is stamped in the same statement, so pods never share a row. */
    claimInFlightDue(params: {
        now: Date;
        tiers: RecheckTier[];
        limit: number;
    }): Promise<MoneriumTrackedOrderRow[]> {
        const due = db
            .select({ id: moneriumTrackedOrdersTable.id })
            .from(moneriumTrackedOrdersTable)
            .where(
                and(
                    inArray(moneriumTrackedOrdersTable.state, [
                        "placed",
                        "pending",
                    ]),
                    dueWithBackoff({
                        since: moneriumTrackedOrdersTable.createdAt,
                        fallback: moneriumTrackedOrdersTable.createdAt,
                        checkedAt: moneriumTrackedOrdersTable.lastCheckedAt,
                        tiers: params.tiers,
                        now: params.now,
                    })
                )
            )
            .orderBy(oldestCheckFirst(moneriumTrackedOrdersTable.lastCheckedAt))
            .limit(params.limit)
            .for("update", { skipLocked: true });
        return db
            .update(moneriumTrackedOrdersTable)
            .set({ lastCheckedAt: params.now })
            .where(inArray(moneriumTrackedOrdersTable.id, due))
            .returning();
    }
}
