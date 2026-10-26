import {
    and,
    count,
    countDistinct,
    eq,
    gte,
    isNull,
    lt,
    lte,
    min,
    ne,
    notExists,
    or,
    type SQL,
    sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { referralLinksTable } from "../../domain/attribution/db/schema";
import type { GameSelect } from "../../domain/game/db/schema";
import { TICKET_AMOUNTS } from "../../domain/game/tickets";
import { FRAK_MERCHANT_ID } from "../../domain/merchant/constants";
import { interactionLogsTable } from "../../domain/rewards/db/schema";
import { interactionTypes } from "../../domain/rewards/schemas";
import { db } from "../../infrastructure/persistence/postgres";

type GameWindow = Pick<GameSelect, "startsAt" | "endsAt">;

function countedPurchase(from: Date, endsAt: Date): SQL[] {
    return [
        eq(interactionLogsTable.type, interactionTypes.purchase),
        ne(interactionLogsTable.merchantId, FRAK_MERCHANT_ID),
        isNull(interactionLogsTable.cancelledAt),
        gte(interactionLogsTable.createdAt, from),
        lt(interactionLogsTable.createdAt, endsAt),
    ];
}

/** Resolves the referrer as it stood at purchase time, merchant-scoped link first, like the reward batch. */
function attributedToLink(): SQL | undefined {
    const shadow = alias(referralLinksTable, "shadow");
    return or(
        and(
            eq(referralLinksTable.scope, "merchant"),
            eq(referralLinksTable.merchantId, interactionLogsTable.merchantId)
        ),
        and(
            eq(referralLinksTable.scope, "cross_merchant"),
            notExists(
                db
                    .select({ one: sql`1` })
                    .from(shadow)
                    .where(
                        and(
                            eq(
                                shadow.refereeIdentityGroupId,
                                interactionLogsTable.identityGroupId
                            ),
                            eq(shadow.scope, "merchant"),
                            eq(
                                shadow.merchantId,
                                interactionLogsTable.merchantId
                            ),
                            isNull(shadow.removedAt),
                            lte(
                                shadow.createdAt,
                                interactionLogsTable.createdAt
                            )
                        )
                    )
            )
        )
    );
}

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

    /** The join ticket plus those earned from purchases in `[max(joinedAt, startsAt), endsAt)`. */
    async ticketsOf(
        game: GameWindow,
        identityGroupId: string,
        joinedAt: Date
    ): Promise<number> {
        const from = joinedAt > game.startsAt ? joinedAt : game.startsAt;
        const purchases = countedPurchase(from, game.endsAt);
        const [own, referred] = await Promise.all([
            db
                .select({ n: count() })
                .from(interactionLogsTable)
                .where(
                    and(
                        eq(
                            interactionLogsTable.identityGroupId,
                            identityGroupId
                        ),
                        ...purchases
                    )
                ),
            db
                .select({ n: countDistinct(interactionLogsTable.id) })
                .from(referralLinksTable)
                .innerJoin(
                    interactionLogsTable,
                    eq(
                        interactionLogsTable.identityGroupId,
                        referralLinksTable.refereeIdentityGroupId
                    )
                )
                .where(
                    and(
                        eq(
                            referralLinksTable.referrerIdentityGroupId,
                            identityGroupId
                        ),
                        isNull(referralLinksTable.removedAt),
                        lte(
                            referralLinksTable.createdAt,
                            interactionLogsTable.createdAt
                        ),
                        ...purchases,
                        attributedToLink()
                    )
                ),
        ]);
        return (
            TICKET_AMOUNTS.join +
            (own[0]?.n ?? 0) * TICKET_AMOUNTS.purchase +
            (referred[0]?.n ?? 0) * TICKET_AMOUNTS.referredPurchase
        );
    }
}
