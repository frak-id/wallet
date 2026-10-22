import { asc, desc, eq, gt } from "drizzle-orm";
import { db } from "../../../infrastructure/persistence/postgres";
import { type GameInsert, type GameSelect, gamesTable } from "../db/schema";
import type { GameStatus } from "../schemas";
import { isGameOpen } from "../utils";

export class GameRepository {
    async create(game: GameInsert): Promise<GameSelect> {
        const [created] = await db.insert(gamesTable).values(game).returning();
        if (!created) throw new Error("Failed to create game");
        return created;
    }

    async findByReferralCodeId(
        referralCodeId: string
    ): Promise<GameSelect | null> {
        const [game] = await db
            .select()
            .from(gamesTable)
            .where(eq(gamesTable.referralCodeId, referralCodeId))
            .limit(1);
        return game ?? null;
    }

    /** Open games, the one closing first first. */
    async findOpen(now: Date): Promise<GameSelect[]> {
        const unfinished = await db
            .select()
            .from(gamesTable)
            .where(gt(gamesTable.endsAt, now))
            .orderBy(asc(gamesTable.endsAt));
        return unfinished.filter((game) => isGameOpen(game, now));
    }

    async findCurrent(now: Date): Promise<GameSelect | null> {
        const [first] = await this.findOpen(now);
        return first ?? null;
    }

    async list(): Promise<GameSelect[]> {
        return db.select().from(gamesTable).orderBy(desc(gamesTable.startsAt));
    }

    async setStatus(
        referralCodeId: string,
        status: GameStatus
    ): Promise<GameSelect | null> {
        const [game] = await db
            .update(gamesTable)
            .set({ status, updatedAt: new Date() })
            .where(eq(gamesTable.referralCodeId, referralCodeId))
            .returning();
        return game ?? null;
    }
}
