import { and, desc, eq, inArray, isNotNull, lt, sql } from "drizzle-orm";
import { LRUCache } from "lru-cache";
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

type FrozenEntries = {
    participants: number;
    byGroup: ReadonlyMap<string, DrawEntry>;
};

export class GameDrawRepository {
    /** Entries are written once at freeze, so every player's lookup shares one read per draw. */
    private readonly frozenEntries = new LRUCache<string, FrozenEntries>({
        max: 32,
        maxSize: 200_000,
        sizeCalculation: (frozen) => frozen.participants + 1,
        fetchMethod: async (drawId) => {
            const [row] = await db
                .select({ entries: gameDrawsTable.entries })
                .from(gameDrawsTable)
                .where(eq(gameDrawsTable.id, drawId));
            if (!row) return undefined;
            return {
                participants: row.entries.length,
                byGroup: new Map(
                    row.entries.map((entry) => [entry.identityGroupId, entry])
                ),
            };
        },
    });

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

    /** Each game's draw status and totals, without the frozen list. */
    async findSummaries(gameIds: string[]) {
        if (gameIds.length === 0) return [];
        return db
            .select({
                gameId: gameDrawsTable.gameId,
                status: gameDrawsTable.status,
                totalTickets: gameDrawsTable.totalTickets,
                frozenAt: gameDrawsTable.frozenAt,
            })
            .from(gameDrawsTable)
            .where(inArray(gameDrawsTable.gameId, gameIds));
    }

    /** Each draw's outcome and the line of the first of `identityGroupIds` found in it. */
    async findOutcomes(gameIds: string[], identityGroupIds: string[]) {
        if (gameIds.length === 0) return [];
        const draws = await db
            .select({
                id: gameDrawsTable.id,
                gameId: gameDrawsTable.gameId,
                status: gameDrawsTable.status,
                totalTickets: gameDrawsTable.totalTickets,
                winnerIdentityGroupId: gameDrawsTable.winnerIdentityGroupId,
                confirmedAt: gameDrawsTable.confirmedAt,
                candidates: gameDrawsTable.candidates,
                rejections: gameDrawsTable.rejections,
                notifiedRank: gameDrawsTable.notifiedRank,
                candidateNotifiedAt: gameDrawsTable.candidateNotifiedAt,
            })
            .from(gameDrawsTable)
            .where(inArray(gameDrawsTable.gameId, gameIds));
        return Promise.all(
            draws.map(async ({ id, ...draw }) => {
                const frozen = await this.frozenEntries.fetch(id);
                const mine = identityGroupIds.flatMap(
                    (groupId) => frozen?.byGroup.get(groupId) ?? []
                );
                // With merged groups that each played, the one holding the turn speaks for the caller.
                const turn =
                    draw.status === "drawn"
                        ? draw.candidates?.[draw.rejections.length]
                        : undefined;
                const entry =
                    mine.find((found) => found.pid === turn) ?? mine[0];
                return {
                    ...draw,
                    participants: frozen?.participants ?? 0,
                    entry: entry ?? null,
                };
            })
        );
    }

    async findByStatus(status: DrawStatus): Promise<GameDrawSelect[]> {
        return db
            .select()
            .from(gameDrawsTable)
            .where(eq(gameDrawsTable.status, status));
    }

    /** Confirmed draws and the payout each one created, latest first. */
    async findConfirmedPayouts(limit: number): Promise<
        {
            gameId: string;
            assetLogId: string;
            winnerIdentityGroupId: string | null;
            confirmedAt: Date | null;
        }[]
    > {
        const rows = await db
            .select({
                gameId: gameDrawsTable.gameId,
                assetLogId: gameDrawsTable.assetLogId,
                winnerIdentityGroupId: gameDrawsTable.winnerIdentityGroupId,
                confirmedAt: gameDrawsTable.confirmedAt,
            })
            .from(gameDrawsTable)
            .where(
                and(
                    eq(gameDrawsTable.status, "confirmed"),
                    isNotNull(gameDrawsTable.assetLogId)
                )
            )
            .orderBy(desc(gameDrawsTable.confirmedAt))
            .limit(limit);
        return rows.flatMap(({ assetLogId, ...row }) =>
            assetLogId ? [{ ...row, assetLogId }] : []
        );
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

    /** `false` when that rank was already told: a push goes out once per candidate. */
    async markCandidateNotified(params: {
        id: string;
        rank: number;
        kind: "drawn" | "reminder";
        at: Date;
    }): Promise<boolean> {
        const column =
            params.kind === "drawn"
                ? gameDrawsTable.notifiedRank
                : gameDrawsTable.remindedRank;
        const updated = await db
            .update(gameDrawsTable)
            .set(
                params.kind === "drawn"
                    ? {
                          notifiedRank: params.rank,
                          candidateNotifiedAt: params.at,
                      }
                    : { remindedRank: params.rank }
            )
            .where(
                and(
                    underReview(params.id, params.rank),
                    lt(column, params.rank)
                )
            )
            .returning({ id: gameDrawsTable.id });
        return updated.length > 0;
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
