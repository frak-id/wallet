import { t } from "@backend-utils";
import type { Static } from "elysia";

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

export const CurrentGameResponseSchema = t.Object({
    game: t.Union([GameSummarySchema, t.Null()]),
    me: t.Object({
        participating: t.Boolean(),
        tickets: t.Number(),
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
