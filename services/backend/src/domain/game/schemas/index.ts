import { t } from "@backend-utils";
import type { Static } from "elysia";

/** `paused` is the kill switch: the drop stops accepting joins at once. */
export const DropStatusSchema = t.Union([
    t.Literal("active"),
    t.Literal("paused"),
]);
export type DropStatus = Static<typeof DropStatusSchema>;

const DropSponsorSchema = t.Object({
    id: t.String(),
    name: t.String(),
    domain: t.String(),
    logoUrl: t.Optional(t.String()),
});

/** What a wallet needs to show a drop it has joined or can join. */
export const DropSummarySchema = t.Object({
    id: t.String(),
    prizeDescription: t.String(),
    /** Fixed join reward, in the Frak merchant's token (EURe). */
    reward: t.Number(),
    startsAt: t.Date(),
    endsAt: t.Date(),
    sponsor: t.Union([DropSponsorSchema, t.Null()]),
});
export type DropSummary = Static<typeof DropSummarySchema>;

export const CurrentDropResponseSchema = t.Object({
    drop: t.Union([
        t.Composite([DropSummarySchema, t.Object({ joined: t.Boolean() })]),
        t.Null(),
    ]),
});
export type CurrentDropResponse = Static<typeof CurrentDropResponseSchema>;

/** What each side of a friend's signup earns, in the Frak merchant's token (EURe). */
export const InviteRewardsSchema = t.Object({
    referrer: t.Number(),
    referee: t.Number(),
});
export type InviteRewards = Static<typeof InviteRewardsSchema>;
