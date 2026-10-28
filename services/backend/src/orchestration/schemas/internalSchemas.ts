import { t } from "@backend-utils";
import type { Static, TSchema } from "elysia";
import { CampaignStatusSchema } from "../../domain/campaign/schemas";
import {
    DrawDiscardSchema,
    DrawRejectionReasonSchema,
    DrawStatusSchema,
    GameStatusSchema,
    TicketBreakdownSchema,
} from "../../domain/game/schemas";
import { DRAW_CHECK_IDS } from "../../domain/game/verify";
import { InstagramLevelSchema } from "../../domain/instagram/schemas";

const Nullable = <T extends TSchema>(schema: T) => t.Union([schema, t.Null()]);

const PositiveAmount = t.Number({ exclusiveMinimum: 0 });
const UnlockDays = t.Optional(t.Integer({ minimum: 1, maximum: 365 }));

export const FrakCodeSchema = t.Object({
    id: t.String(),
    code: t.String(),
    createdAt: t.Date(),
    revokedAt: Nullable(t.Date()),
    /** Every redemption, including referees who later replaced Frak. */
    redemptions: t.Number(),
    /** Referees who still have Frak as referrer through this code. */
    activeReferees: t.Number(),
    gameId: Nullable(t.String()),
});
export type FrakCode = Static<typeof FrakCodeSchema>;

export const FrakCodeListSchema = t.Object({ codes: t.Array(FrakCodeSchema) });

export const IssueFrakCodeBodySchema = t.Object({
    code: t.Optional(t.String({ minLength: 1, maxLength: 16 })),
});

export const FrakRuleSummarySchema = t.Object({
    id: t.String(),
    name: t.String(),
    status: CampaignStatusSchema,
    rewards: t.Array(t.Object({ recipient: t.String(), amount: t.Number() })),
    budget: t.Object({ total: Nullable(t.Number()), used: t.Number() }),
    expiresAt: Nullable(t.Date()),
});
export type FrakRuleSummary = Static<typeof FrakRuleSummarySchema>;

export const FrakGameSetupSchema = t.Object({
    merchant: Nullable(
        t.Object({
            id: t.String(),
            name: t.String(),
            domain: t.String(),
            bankAddress: Nullable(t.String()),
        })
    ),
    signupRules: t.Array(FrakRuleSummarySchema),
});
export type FrakGameSetup = Static<typeof FrakGameSetupSchema>;

export const SeedFrakMerchantBodySchema = t.Object({
    domain: t.String({ minLength: 1 }),
    /** Wallet address or business account id; the acting admin when absent. */
    owner: t.Optional(t.String({ minLength: 1 })),
});

export const PublishSignupRuleBodySchema = t.Object({
    referrer: PositiveAmount,
    referee: PositiveAmount,
    budget: PositiveAmount,
    unlockDays: UnlockDays,
});
export type PublishSignupRuleInput = Static<typeof PublishSignupRuleBodySchema>;

export const GameAdminSchema = t.Object({
    id: t.String(),
    code: t.String(),
    status: GameStatusSchema,
    startsAt: t.Date(),
    endsAt: t.Date(),
    createdAt: t.Date(),
    prizeAmount: t.Number(),
    prizeDescription: Nullable(t.String()),
    sponsor: Nullable(
        t.Object({ id: t.String(), name: t.String(), domain: t.String() })
    ),
    rule: Nullable(FrakRuleSummarySchema),
    participants: t.Number(),
    draw: Nullable(
        t.Object({
            status: DrawStatusSchema,
            totalTickets: t.Number(),
            frozenAt: t.Date(),
        })
    ),
});
export type GameAdmin = Static<typeof GameAdminSchema>;

export const GameAdminListSchema = t.Object({
    games: t.Array(GameAdminSchema),
});

export const CreateGameBodySchema = t.Object({
    code: t.String({ minLength: 1 }),
    reward: PositiveAmount,
    budget: PositiveAmount,
    startsAt: t.Date(),
    endsAt: t.Date(),
    /** In EUR, paid in EURe. */
    prizeAmount: PositiveAmount,
    prizeDescription: t.Optional(t.String({ maxLength: 500 })),
    sponsorMerchantId: t.Optional(t.String({ format: "uuid" })),
    unlockDays: UnlockDays,
});
export type CreateGameInput = Static<typeof CreateGameBodySchema>;

export const SetGameStatusBodySchema = t.Object({ status: GameStatusSchema });

const InstagramStateSchema = t.Object({
    level: InstagramLevelSchema,
    username: Nullable(t.String()),
    follows: Nullable(t.Boolean()),
});

export const GamePlayerSchema = t.Object({
    identityGroupId: t.String(),
    wallet: Nullable(t.String()),
    joinedAt: Nullable(t.Date()),
    tickets: TicketBreakdownSchema,
    totalTickets: t.Number(),
    /** Live: would keep their tickets if frozen now. Frozen: kept them. */
    eligible: t.Boolean(),
    drawTickets: Nullable(t.Number()),
    discarded: Nullable(DrawDiscardSchema),
    pid: Nullable(t.String()),
    instagram: InstagramStateSchema,
});
export type GamePlayer = Static<typeof GamePlayerSchema>;

export const GamePlayersSchema = t.Object({
    source: t.Union([t.Literal("live"), t.Literal("frozen")]),
    computedAt: t.Date(),
    players: t.Array(GamePlayerSchema),
});
export type GamePlayers = Static<typeof GamePlayersSchema>;

export const GamePlayersQuerySchema = t.Object({
    fresh: t.Optional(t.BooleanString()),
});

export const DrawCandidateSchema = t.Object({
    rank: t.Number(),
    pid: t.String(),
    identityGroupId: t.String(),
    wallet: Nullable(t.String()),
    accountCreatedAt: Nullable(t.Date()),
    instagram: t.Object({
        ...InstagramStateSchema.properties,
        checkedAt: Nullable(t.Date()),
        /** False when Meta could not be reached for this read. */
        followFresh: t.Boolean(),
    }),
    awaiting: t.Union([t.Literal("admin"), t.Literal("player")]),
    verifyBy: Nullable(t.Date()),
    drawTickets: t.Number(),
    tickets: TicketBreakdownSchema,
});

export const GameDrawAdminSchema = t.Object({
    status: DrawStatusSchema,
    algorithm: t.String(),
    frozenAt: t.Date(),
    snapshotRoot: t.String(),
    totalTickets: t.Number(),
    participants: t.Number(),
    eligibleParticipants: t.Number(),
    drand: t.Object({
        round: t.Number(),
        roundTime: t.Date(),
        signed: t.Boolean(),
    }),
    candidates: t.Number(),
    candidateWindow: t.Boolean(),
    rejections: t.Array(
        t.Object({
            rank: t.Number(),
            pid: t.String(),
            reason: DrawRejectionReasonSchema,
            actor: t.String(),
            at: t.String(),
        })
    ),
    winner: Nullable(
        t.Object({
            identityGroupId: t.String(),
            wallet: Nullable(t.String()),
            confirmedBy: Nullable(t.String()),
            confirmedAt: Nullable(t.Date()),
            assetLogId: Nullable(t.String()),
        })
    ),
    candidate: Nullable(DrawCandidateSchema),
});
export type GameDrawAdmin = Static<typeof GameDrawAdminSchema>;

export const GameDrawResponseSchema = t.Object({
    draw: Nullable(GameDrawAdminSchema),
});

export const RejectCandidateBodySchema = t.Object({
    reason: DrawRejectionReasonSchema,
});

export const DrawVerificationSchema = t.Object({
    checks: t.Array(
        t.Object({
            id: t.UnionEnum(DRAW_CHECK_IDS),
            ok: t.Boolean(),
        })
    ),
});

export const RunDrawsResponseSchema = t.Object({
    frozen: t.Number(),
    drawn: t.Number(),
    advanced: t.Number(),
});

const ReferralLinkViewSchema = t.Object({
    id: t.String(),
    scope: t.String(),
    merchantId: Nullable(t.String()),
    referrerIdentityGroupId: t.String(),
    refereeIdentityGroupId: t.String(),
    source: t.String(),
    createdAt: t.Date(),
    removedAt: Nullable(t.Date()),
    endReason: Nullable(t.String()),
});

const Page = <T extends TSchema>(item: T) =>
    t.Object({ total: t.Number(), items: t.Array(item) });

export const IdentityLookupQuerySchema = t.Object({
    q: t.String({ minLength: 1, maxLength: 64 }),
});

export const IdentityLookupSchema = t.Object({
    groups: t.Array(
        t.Object({
            id: t.String(),
            createdAt: Nullable(t.Date()),
            mergedGroupIds: t.Array(t.String()),
            nodes: t.Array(
                t.Object({
                    type: t.String(),
                    value: t.String(),
                    merchantId: Nullable(t.String()),
                    createdAt: Nullable(t.Date()),
                    unlinkedAt: Nullable(t.Date()),
                })
            ),
        })
    ),
    instagram: t.Array(
        t.Object({
            identityGroupId: t.String(),
            ...InstagramStateSchema.properties,
        })
    ),
    referrers: t.Array(ReferralLinkViewSchema),
    referees: Page(ReferralLinkViewSchema),
    interactions: Page(
        t.Object({
            id: t.String(),
            type: t.String(),
            merchantId: Nullable(t.String()),
            createdAt: t.Date(),
            cancelledAt: Nullable(t.Date()),
            payload: t.Unknown(),
        })
    ),
    assets: Page(
        t.Object({
            id: t.String(),
            assetType: t.String(),
            amount: t.String(),
            status: t.String(),
            recipientType: t.String(),
            recipientWallet: Nullable(t.String()),
            merchantId: t.String(),
            createdAt: t.Date(),
            onchainTxHash: Nullable(t.String()),
        })
    ),
});
export type IdentityLookup = Static<typeof IdentityLookupSchema>;

export const SetupCodeBodySchema = t.Object({
    domain: t.String({ minLength: 1 }),
    /** The owner's wallet address, or their email when walletless. */
    owner: t.String({ minLength: 1 }),
});

export const SetupCodeResponseSchema = t.Object({
    domain: t.String(),
    setupCode: t.String(),
});
