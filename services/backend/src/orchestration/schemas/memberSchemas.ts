import { t } from "@backend-utils";

export const MemberFilterSchema = t.Object({
    merchantIds: t.Optional(t.Array(t.String())),
    interactions: t.Optional(
        t.Object({
            min: t.Optional(t.Number()),
            max: t.Optional(t.Number()),
        })
    ),
    rewards: t.Optional(
        t.Object({
            min: t.Optional(t.String()),
            max: t.Optional(t.String()),
        })
    ),
    firstInteractionTimestamp: t.Optional(
        t.Object({
            min: t.Optional(t.Number()),
            max: t.Optional(t.Number()),
        })
    ),
});

export const MemberSortSchema = t.Object({
    by: t.String(),
    order: t.Union([t.Literal("asc"), t.Literal("desc")]),
});

export const MemberItemSchema = t.Object({
    user: t.Hex(),
    totalInteractions: t.Number(),
    totalRewardsUsd: t.Number(),
    firstInteractionTimestamp: t.String(),
    merchantIds: t.Array(t.String()),
    merchantNames: t.Array(t.String()),
});

export const MemberQueryResultSchema = t.Object({
    totalResult: t.Number(),
    members: t.Array(MemberItemSchema),
});
