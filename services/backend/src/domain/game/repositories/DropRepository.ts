import { asc, desc, eq, gt } from "drizzle-orm";
import { db } from "../../../infrastructure/persistence/postgres";
import { type DropInsert, type DropSelect, dropsTable } from "../db/schema";
import type { DropStatus } from "../schemas";
import { isDropOpen } from "../utils";

export class DropRepository {
    async create(drop: DropInsert): Promise<DropSelect> {
        const [created] = await db.insert(dropsTable).values(drop).returning();
        if (!created) throw new Error("Failed to create drop");
        return created;
    }

    async findByReferralCodeId(
        referralCodeId: string
    ): Promise<DropSelect | null> {
        const [drop] = await db
            .select()
            .from(dropsTable)
            .where(eq(dropsTable.referralCodeId, referralCodeId))
            .limit(1);
        return drop ?? null;
    }

    /** Open drops, the one closing first first. */
    async findOpen(now: Date): Promise<DropSelect[]> {
        const unfinished = await db
            .select()
            .from(dropsTable)
            .where(gt(dropsTable.endsAt, now))
            .orderBy(asc(dropsTable.endsAt));
        return unfinished.filter((drop) => isDropOpen(drop, now));
    }

    async findCurrent(now: Date): Promise<DropSelect | null> {
        const [first] = await this.findOpen(now);
        return first ?? null;
    }

    async list(): Promise<DropSelect[]> {
        return db.select().from(dropsTable).orderBy(desc(dropsTable.startsAt));
    }

    async setStatus(
        referralCodeId: string,
        status: DropStatus
    ): Promise<DropSelect | null> {
        const [drop] = await db
            .update(dropsTable)
            .set({ status, updatedAt: new Date() })
            .where(eq(dropsTable.referralCodeId, referralCodeId))
            .returning();
        return drop ?? null;
    }
}
