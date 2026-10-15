import { db } from "@backend-infrastructure";
import type { MoneriumOrderState } from "@frak-labs/app-essentials/monerium";
import { and, eq, gt, inArray, isNull, lt, or } from "drizzle-orm";
import type { Address } from "viem";
import {
    type MoneriumTrackedOrderRow,
    moneriumTrackedOrdersTable,
} from "../db/schema";

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

    findInFlightDue(params: {
        checkedBefore: Date;
        createdAfter: Date;
        limit: number;
    }): Promise<MoneriumTrackedOrderRow[]> {
        return db
            .select()
            .from(moneriumTrackedOrdersTable)
            .where(
                and(
                    inArray(moneriumTrackedOrdersTable.state, [
                        "placed",
                        "pending",
                    ]),
                    or(
                        isNull(moneriumTrackedOrdersTable.lastCheckedAt),
                        lt(
                            moneriumTrackedOrdersTable.lastCheckedAt,
                            params.checkedBefore
                        )
                    ),
                    gt(
                        moneriumTrackedOrdersTable.createdAt,
                        params.createdAfter
                    )
                )
            )
            .orderBy(moneriumTrackedOrdersTable.lastCheckedAt)
            .limit(params.limit);
    }
}
