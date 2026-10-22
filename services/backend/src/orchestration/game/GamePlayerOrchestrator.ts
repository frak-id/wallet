import { and, eq, min, sql } from "drizzle-orm";
import { FRAK_MERCHANT_ID } from "../../domain/merchant/constants";
import { interactionLogsTable } from "../../domain/rewards/db/schema";
import { interactionTypes } from "../../domain/rewards/schemas";
import { db } from "../../infrastructure/persistence/postgres";

export class GamePlayerOrchestrator {
    /** Earliest `game_join` of the group for the game, null when it never joined. */
    async joinedAt(
        gameId: string,
        identityGroupId: string
    ): Promise<Date | null> {
        const [row] = await db
            .select({ joinedAt: min(interactionLogsTable.createdAt) })
            .from(interactionLogsTable)
            .where(
                and(
                    eq(interactionLogsTable.identityGroupId, identityGroupId),
                    eq(interactionLogsTable.merchantId, FRAK_MERCHANT_ID),
                    eq(interactionLogsTable.type, interactionTypes.gameJoin),
                    sql`${interactionLogsTable.payload}->>'gameId' = ${gameId}`
                )
            );
        return row?.joinedAt ?? null;
    }
}
