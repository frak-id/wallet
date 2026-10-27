import {
    and,
    count,
    countDistinct,
    eq,
    exists,
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
import {
    TICKET_AMOUNTS,
    type TicketBreakdown,
} from "../../domain/game/tickets";
import { identityNodesTable } from "../../domain/identity/db/schema";
import { instagramLinksTable } from "../../domain/instagram/db/schema";
import { FRAK_MERCHANT_ID } from "../../domain/merchant/constants";
import { interactionLogsTable } from "../../domain/rewards/db/schema";
import { interactionTypes } from "../../domain/rewards/schemas";
import { db } from "../../infrastructure/persistence/postgres";

type GameWindow = Pick<GameSelect, "startsAt" | "endsAt">;

const joinedGameId = sql<
    string | null
>`${interactionLogsTable.payload}->>'gameId'`;

/** The Frak merchant's `game_join` interactions, of one game when `gameId` is set. */
function gameJoins(gameId?: string): SQL[] {
    return [
        eq(interactionLogsTable.merchantId, FRAK_MERCHANT_ID),
        eq(interactionLogsTable.type, interactionTypes.gameJoin),
        ...(gameId ? [sql`${joinedGameId} = ${gameId}`] : []),
    ];
}

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

/** Friends who signed up with the holder's code in the window and now follow @frak_fr; the referrer comes from the link, which merges keep current. */
function followingSignups(holderGroupId: string, from: Date, endsAt: Date) {
    return db
        .select({ n: countDistinct(interactionLogsTable.identityGroupId) })
        .from(interactionLogsTable)
        .innerJoin(
            referralLinksTable,
            eq(
                referralLinksTable.refereeIdentityGroupId,
                interactionLogsTable.identityGroupId
            )
        )
        .innerJoin(
            instagramLinksTable,
            eq(
                instagramLinksTable.identityGroupId,
                interactionLogsTable.identityGroupId
            )
        )
        .where(
            and(
                eq(interactionLogsTable.type, interactionTypes.referralSignup),
                eq(interactionLogsTable.merchantId, FRAK_MERCHANT_ID),
                gte(interactionLogsTable.createdAt, from),
                lt(interactionLogsTable.createdAt, endsAt),
                eq(referralLinksTable.referrerIdentityGroupId, holderGroupId),
                eq(referralLinksTable.scope, "cross_merchant"),
                isNull(referralLinksTable.removedAt),
                eq(instagramLinksTable.follows, true)
            )
        );
}

/** Distinct friends whose brand link to the holder was created in the window and who have a wallet, so an anonymous browser loop earns nothing. */
function brandShareFriends(holderGroupId: string, from: Date, endsAt: Date) {
    const hasWallet = db
        .select({ one: sql`1` })
        .from(identityNodesTable)
        .where(
            and(
                eq(
                    identityNodesTable.groupId,
                    referralLinksTable.refereeIdentityGroupId
                ),
                eq(identityNodesTable.identityType, "wallet"),
                isNull(identityNodesTable.unlinkedAt)
            )
        );
    return db
        .select({ n: countDistinct(referralLinksTable.refereeIdentityGroupId) })
        .from(referralLinksTable)
        .where(
            and(
                eq(referralLinksTable.referrerIdentityGroupId, holderGroupId),
                eq(referralLinksTable.scope, "merchant"),
                ne(referralLinksTable.merchantId, FRAK_MERCHANT_ID),
                isNull(referralLinksTable.removedAt),
                gte(referralLinksTable.createdAt, from),
                lt(referralLinksTable.createdAt, endsAt),
                exists(hasWallet)
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
                    ...gameJoins(gameId)
                )
            );
        return row?.joinedAt ?? null;
    }

    /** Every game the group joined, with its first join; merges move joins to the surviving group. */
    async gamesJoinedBy(
        identityGroupId: string
    ): Promise<{ gameId: string; joinedAt: Date }[]> {
        const rows = await db
            .select({
                gameId: joinedGameId,
                joinedAt: min(interactionLogsTable.createdAt),
            })
            .from(interactionLogsTable)
            .where(
                and(
                    eq(interactionLogsTable.identityGroupId, identityGroupId),
                    ...gameJoins()
                )
            )
            .groupBy(joinedGameId);
        return rows.flatMap(({ gameId, joinedAt }) =>
            gameId && joinedAt ? [{ gameId, joinedAt }] : []
        );
    }

    /** Everyone who joined the game, with their first join. */
    async participantsOf(
        gameId: string
    ): Promise<{ identityGroupId: string; joinedAt: Date }[]> {
        const rows = await db
            .select({
                identityGroupId: interactionLogsTable.identityGroupId,
                joinedAt: min(interactionLogsTable.createdAt),
            })
            .from(interactionLogsTable)
            .where(and(...gameJoins(gameId)))
            .groupBy(interactionLogsTable.identityGroupId);
        return rows.flatMap(({ identityGroupId, joinedAt }) =>
            identityGroupId && joinedAt ? [{ identityGroupId, joinedAt }] : []
        );
    }

    /** Tickets per source: the join, plus purchases, friends' signups and brand shares in `[max(joinedAt, startsAt), endsAt)`. */
    async ticketsOf(
        game: GameWindow,
        identityGroupId: string,
        joinedAt: Date
    ): Promise<TicketBreakdown> {
        const from = joinedAt > game.startsAt ? joinedAt : game.startsAt;
        const purchases = countedPurchase(from, game.endsAt);
        const [own, referred, signups, brandFriends] = await Promise.all([
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
            followingSignups(identityGroupId, from, game.endsAt),
            brandShareFriends(identityGroupId, from, game.endsAt),
        ]);
        return {
            join: TICKET_AMOUNTS.join,
            purchase: (own[0]?.n ?? 0) * TICKET_AMOUNTS.purchase,
            referredPurchase:
                (referred[0]?.n ?? 0) * TICKET_AMOUNTS.referredPurchase,
            referredSignup:
                (signups[0]?.n ?? 0) * TICKET_AMOUNTS.referredSignup,
            brandShare: (brandFriends[0]?.n ?? 0) * TICKET_AMOUNTS.brandShare,
        };
    }
}
