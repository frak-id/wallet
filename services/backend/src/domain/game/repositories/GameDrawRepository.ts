import { and, eq, inArray, sql } from "drizzle-orm";
import {
    db,
    type PgRunner,
} from "../../../infrastructure/persistence/postgres";
import {
    type GameDrawInsert,
    type GameDrawSelect,
    gameDrawsTable,
} from "../db/schema";
import type { DrawEntry, DrawRejection, DrawStatus } from "../schemas";

/** The draw is still `drawn` and nobody reviewed it since `reviewed` rejections. */
function underReview(id: string, reviewed: number) {
    return and(
        eq(gameDrawsTable.id, id),
        eq(gameDrawsTable.status, "drawn"),
        sql`jsonb_array_length(${gameDrawsTable.rejections}) = ${reviewed}`
    );
}

export class GameDrawRepository {
    /** `null` when the game already has a draw: a freeze never runs twice. */
    async create(draw: GameDrawInsert): Promise<GameDrawSelect | null> {
        const [created] = await db
            .insert(gameDrawsTable)
            .values(draw)
            .onConflictDoNothing({ target: gameDrawsTable.gameId })
            .returning();
        return created ?? null;
    }

    async findByGameId(gameId: string): Promise<GameDrawSelect | null> {
        const [draw] = await db
            .select()
            .from(gameDrawsTable)
            .where(eq(gameDrawsTable.gameId, gameId))
            .limit(1);
        return draw ?? null;
    }

    /** Each draw's outcome and the line of any of `identityGroupIds`, without loading the other entries. */
    async findOutcomes(gameIds: string[], identityGroupIds: string[]) {
        if (gameIds.length === 0 || identityGroupIds.length === 0) return [];
        const groups = sql.join(
            identityGroupIds.map((id) => sql`${id}`),
            sql`, `
        );
        return db
            .select({
                gameId: gameDrawsTable.gameId,
                status: gameDrawsTable.status,
                totalTickets: gameDrawsTable.totalTickets,
                participants: sql<number>`jsonb_array_length(${gameDrawsTable.entries})`,
                winnerIdentityGroupId: gameDrawsTable.winnerIdentityGroupId,
                confirmedAt: gameDrawsTable.confirmedAt,
                entry: sql<DrawEntry | null>`(select e.value from jsonb_array_elements(${gameDrawsTable.entries}) as e where e.value->>'identityGroupId' in (${groups}) limit 1)`,
            })
            .from(gameDrawsTable)
            .where(inArray(gameDrawsTable.gameId, gameIds));
    }

    async findByStatus(status: DrawStatus): Promise<GameDrawSelect[]> {
        return db
            .select()
            .from(gameDrawsTable)
            .where(eq(gameDrawsTable.status, status));
    }

    async recordBeacon(params: {
        id: string;
        signature: string;
        candidates: string[];
    }): Promise<GameDrawSelect | null> {
        const [drawn] = await db
            .update(gameDrawsTable)
            .set({
                status: params.candidates.length > 0 ? "drawn" : "void",
                drandSignature: params.signature,
                candidates: params.candidates,
                updatedAt: new Date(),
            })
            .where(
                and(
                    eq(gameDrawsTable.id, params.id),
                    eq(gameDrawsTable.status, "frozen")
                )
            )
            .returning();
        return drawn ?? null;
    }

    /** `null` when someone reviewed the draw meanwhile. Rejecting the last candidate voids it. */
    async addRejection(params: {
        id: string;
        reviewed: number;
        rejection: DrawRejection;
        exhausted: boolean;
    }): Promise<GameDrawSelect | null> {
        const [updated] = await db
            .update(gameDrawsTable)
            .set({
                rejections: sql`${gameDrawsTable.rejections} || ${JSON.stringify([params.rejection])}::jsonb`,
                status: params.exhausted ? "void" : "drawn",
                updatedAt: new Date(),
            })
            .where(underReview(params.id, params.reviewed))
            .returning();
        return updated ?? null;
    }

    async confirm(
        params: {
            id: string;
            reviewed: number;
            winnerIdentityGroupId: string;
            confirmedBy: string;
            assetLogId: string;
        },
        runner: PgRunner = db
    ): Promise<GameDrawSelect | null> {
        const now = new Date();
        const [confirmed] = await runner
            .update(gameDrawsTable)
            .set({
                status: "confirmed",
                winnerIdentityGroupId: params.winnerIdentityGroupId,
                confirmedBy: params.confirmedBy,
                confirmedAt: now,
                assetLogId: params.assetLogId,
                updatedAt: now,
            })
            .where(underReview(params.id, params.reviewed))
            .returning();
        return confirmed ?? null;
    }
}
