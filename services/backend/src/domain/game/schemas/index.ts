import { t } from "@backend-utils";
import type { Static } from "elysia";
import type { TicketBreakdown } from "../tickets";

export type { TicketSource } from "../tickets";

/** `paused` is the kill switch: the game stops accepting joins at once. */
export const GameStatusSchema = t.Union([
    t.Literal("active"),
    t.Literal("paused"),
]);
export type GameStatus = Static<typeof GameStatusSchema>;

const GameSponsorSchema = t.Object({
    id: t.String(),
    name: t.String(),
    domain: t.String(),
    logoUrl: t.Optional(t.String()),
});

/** What a wallet needs to show a game it has joined or can join. */
export const GameSummarySchema = t.Object({
    id: t.String(),
    /** Prize value in EUR. */
    prizeAmount: t.Number(),
    prizeDescription: t.Union([t.String(), t.Null()]),
    startsAt: t.Date(),
    endsAt: t.Date(),
    sponsor: t.Union([GameSponsorSchema, t.Null()]),
});
export type GameSummary = Static<typeof GameSummarySchema>;

/** Tickets per source, already multiplied by their amount; they add up to `tickets`. */
export const TicketBreakdownSchema = t.Object({
    join: t.Number(),
    purchase: t.Number(),
    referredPurchase: t.Number(),
    referredSignup: t.Number(),
    brandShare: t.Number(),
});

export const CurrentGameResponseSchema = t.Object({
    game: t.Union([GameSummarySchema, t.Null()]),
    me: t.Object({
        participating: t.Boolean(),
        tickets: t.Number(),
        ticketsBySource: TicketBreakdownSchema,
        eligible: t.Boolean(),
    }),
});
export type CurrentGameResponse = Static<typeof CurrentGameResponseSchema>;

/** What each side of a friend's signup earns, in the Frak merchant's token (EURe). */
export const InviteRewardsSchema = t.Object({
    referrer: t.Number(),
    referee: t.Number(),
});
export type InviteRewards = Static<typeof InviteRewardsSchema>;

/** `void`: nobody held an eligible ticket, or every candidate was rejected. */
export const DrawStatusSchema = t.Union([
    t.Literal("frozen"),
    t.Literal("drawn"),
    t.Literal("confirmed"),
    t.Literal("void"),
]);
export type DrawStatus = Static<typeof DrawStatusSchema>;

/** The only grounds the rules allow for passing over a drawn candidate. */
export const DrawRejectionReasonSchema = t.Union([
    t.Literal("not_following_at_review"),
    t.Literal("fraud"),
    t.Literal("unreachable"),
    t.Literal("ineligible"),
]);
export type DrawRejectionReason = Static<typeof DrawRejectionReasonSchema>;

/** One participant as frozen: `drawTickets` is 0 when `discarded` is set. */
export type DrawEntry = {
    pid: string;
    identityGroupId: string;
    tickets: TicketBreakdown;
    drawTickets: number;
    discarded: "not_following" | null;
};

export type DrawRejection = {
    pid: string;
    reason: DrawRejectionReason;
    actor: string;
    at: string;
};

/** Everything needed to replay a draw, naming players by pid only. */
export const PublicDrawSchema = t.Object({
    gameId: t.String(),
    algorithm: t.String(),
    status: DrawStatusSchema,
    frozenAt: t.Date(),
    snapshotRoot: t.String(),
    totalTickets: t.Number(),
    participants: t.Number(),
    discardedParticipants: t.Number(),
    entries: t.Array(t.Object({ pid: t.String(), tickets: t.Number() })),
    drand: t.Object({
        chainHash: t.String(),
        round: t.Number(),
        roundTime: t.Date(),
        signature: t.Union([t.String(), t.Null()]),
        randomness: t.Union([t.String(), t.Null()]),
    }),
    candidates: t.Array(t.String()),
    rejections: t.Array(
        t.Object({
            pid: t.String(),
            reason: DrawRejectionReasonSchema,
            at: t.String(),
        })
    ),
    winnerPid: t.Union([t.String(), t.Null()]),
    payoutTxHash: t.Union([t.String(), t.Null()]),
});
export type PublicDraw = Static<typeof PublicDrawSchema>;

/** A finished game as its player sees it: `drawing` until the winner is confirmed or the draw is void. */
export const GameOutcomeSchema = t.Union([
    t.Literal("drawing"),
    t.Literal("won"),
    t.Literal("lost"),
    t.Literal("no_winner"),
]);
export type GameOutcome = Static<typeof GameOutcomeSchema>;

/** Tickets come from the frozen draw once there is one, and are counted live before. */
export const GameResultSchema = t.Object({
    game: GameSummarySchema,
    outcome: GameOutcomeSchema,
    ticketsBySource: TicketBreakdownSchema,
    /** The caller's tickets in the draw: 0 once discarded, all of them until the freeze. */
    drawTickets: t.Number(),
    /** Set when the caller's tickets did not count in the draw. */
    discarded: t.Union([t.Literal("not_following"), t.Null()]),
    /** The caller's id in the public draw list; null until the freeze, or when their tickets did not count. */
    pid: t.Union([t.String(), t.Null()]),
    /** Every ticket in the draw; null until the freeze. */
    totalTickets: t.Union([t.Number(), t.Null()]),
    participants: t.Union([t.Number(), t.Null()]),
    confirmedAt: t.Union([t.Date(), t.Null()]),
});
export type GameResult = Static<typeof GameResultSchema>;

export const GameHistoryResponseSchema = t.Object({
    games: t.Array(GameResultSchema),
});
