import { db } from "@backend-infrastructure";
import { and, eq, lt } from "drizzle-orm";
import type { Address } from "viem";
import {
    type MoneriumPendingAuthRow,
    moneriumPendingAuthsTable,
} from "../db/schema";

export class MoneriumPendingAuthRepository {
    async create(
        row: Omit<MoneriumPendingAuthRow, "createdAt">
    ): Promise<void> {
        await db
            .delete(moneriumPendingAuthsTable)
            .where(lt(moneriumPendingAuthsTable.expiresAt, new Date()));
        await db.insert(moneriumPendingAuthsTable).values(row);
    }

    /** Deletes and returns the row in one statement: a state can be spent only once. */
    async consume(
        state: string,
        wallet: Address
    ): Promise<MoneriumPendingAuthRow | undefined> {
        const [row] = await db
            .delete(moneriumPendingAuthsTable)
            .where(
                and(
                    eq(moneriumPendingAuthsTable.state, state),
                    eq(moneriumPendingAuthsTable.wallet, wallet)
                )
            )
            .returning();
        return row;
    }

    async deleteByWallet(wallet: Address): Promise<void> {
        await db
            .delete(moneriumPendingAuthsTable)
            .where(eq(moneriumPendingAuthsTable.wallet, wallet));
    }
}
