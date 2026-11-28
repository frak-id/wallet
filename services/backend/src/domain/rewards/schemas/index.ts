import { t } from "@backend-utils";
import type { Static } from "elysia";

/**
 * Unified vocabulary for both interaction logs and campaign triggers.
 *
 * Reach for these instead of a bare string inside a `sql` template: the column is
 * `text().$type<InteractionType>()`, so a literal written there is checked by nothing.
 */
export const interactionTypes = {
    referral: "referral",
    createReferralLink: "create_referral_link",
    purchase: "purchase",
    custom: "custom",
    referralSignup: "referral_signup",
    gameJoin: "game_join",
} as const;

export const InteractionTypeSchema = t.Union([
    t.Literal(interactionTypes.referral),
    t.Literal(interactionTypes.createReferralLink),
    t.Literal(interactionTypes.purchase),
    t.Literal(interactionTypes.custom),
    t.Literal(interactionTypes.referralSignup),
    t.Literal(interactionTypes.gameJoin),
]);
export type InteractionType = Static<typeof InteractionTypeSchema>;

/**
 * What earns a plan step after the first payment: each paid billing cycle,
 * each `stepAmount` paid, or each `stepDays` subscribed.
 */
export const SubscriptionStepBySchema = t.Union([
    t.Literal("cycle"),
    t.Literal("amount"),
    t.Literal("duration"),
]);
export type SubscriptionStepBy = Static<typeof SubscriptionStepBySchema>;

export function subscriptionStepBy(
    rule: { subscription?: { stepBy?: SubscriptionStepBy } } | undefined
): SubscriptionStepBy {
    return rule?.subscription?.stepBy ?? "cycle";
}

export const AssetStatusSchema = t.Union([
    t.Literal("pending"),
    t.Literal("processing"),
    t.Literal("settled"),
    t.Literal("cancelled"),
    t.Literal("expired"),
    t.Literal("bank_depleted"),
]);
export type AssetStatus = Static<typeof AssetStatusSchema>;

/** Statuses of a reward that still counts: caps, and the welcome-bonus claim. */
export const LIVE_ASSET_STATUSES = [
    "pending",
    "processing",
    "settled",
    "bank_depleted",
] as const satisfies readonly AssetStatus[];

/**
 * Status surfaced to wallet clients. Superset of {@link AssetStatusSchema}
 * with two display-only states, never persisted to `asset_logs.status`:
 * `consumed` (derived by the wallet from `settled`) and `locked` (a `pending`
 * reward that is held and not released yet).
 */
export const RewardDisplayStatusSchema = t.Union([
    ...AssetStatusSchema.anyOf,
    t.Literal("consumed"),
    t.Literal("locked"),
]);
export type RewardDisplayStatus = Static<typeof RewardDisplayStatusSchema>;

/**
 * Reason a reward was moved to a terminal non-settled status.
 *
 * `refund` -> the upstream purchase was refunded (full or partial).
 * `expired` -> the reward sat in `pending` past `expires_at` without being settled.
 * `self_referral_detected` -> a late identity merge revealed the referrer and referee share an identity.
 * `manual` -> cancelled via admin tool / support action.
 */
export const CancellationReasonSchema = t.Union([
    t.Literal("refund"),
    t.Literal("expired"),
    t.Literal("self_referral_detected"),
    t.Literal("manual"),
]);
export type CancellationReason = Static<typeof CancellationReasonSchema>;

export const AssetTypeSchema = t.Literal("token");
export type AssetType = Static<typeof AssetTypeSchema>;

export const RecipientTypeSchema = t.Union([
    t.Literal("referrer"),
    t.Literal("referee"),
]);
export type RecipientType = Static<typeof RecipientTypeSchema>;

/**
 * Recipient of a persisted reward. `welcome_bonus` is a Frak referrer share
 * redirected to the referee, `winner` a Frak Game prize; campaign configs
 * keep {@link RecipientTypeSchema}.
 */
export const AssetLogRecipientTypeSchema = t.Union([
    ...RecipientTypeSchema.anyOf,
    t.Literal("welcome_bonus"),
    t.Literal("winner"),
]);
export type AssetLogRecipientType = Static<typeof AssetLogRecipientTypeSchema>;

const MerchantInfoSchema = t.Object({
    id: t.String(),
    name: t.String(),
    domain: t.String(),
    heroImageUrl: t.Optional(t.String()),
    logoUrl: t.Optional(t.String()),
});

const TokenInfoSchema = t.Object({
    symbol: t.String(),
    decimals: t.Number(),
});

const PurchaseInfoSchema = t.Object({
    id: t.String(),
    amount: t.Number(),
    currency: t.String(),
});
export type PurchaseInfo = Static<typeof PurchaseInfoSchema>;

/**
 * A subscription step as the wallet shows it: `paid` settled, `unlocking` earned
 * and on its way (see `availableAt`), `upcoming` waiting on a future cycle,
 * `expired` never earned in time.
 */
const PlanStepStatusSchema = t.Union([
    t.Literal("paid"),
    t.Literal("unlocking"),
    t.Literal("upcoming"),
    t.Literal("expired"),
]);
export type PlanStepStatus = Static<typeof PlanStepStatusSchema>;

const PlanStepSchema = t.Object({
    step: t.Number(),
    amount: t.TokenAmount,
    /** A cycle plan's percentage and tiered steps are priced on the checkout payment until their cycle is paid. */
    estimated: t.Boolean(),
    status: PlanStepStatusSchema,
    availableAt: t.Optional(t.Date()),
    settledAt: t.Optional(t.Date()),
});
export type PlanStep = Static<typeof PlanStepSchema>;

const RewardPlanSchema = t.Object({
    stepBy: SubscriptionStepBySchema,
    /** `duration` plans only: days of active subscription per step. */
    stepDays: t.Optional(t.Number()),
    stepsEarned: t.Number(),
    stepsTotal: t.Number(),
    paidAmount: t.TokenAmount,
    pendingAmount: t.TokenAmount,
    estimated: t.Boolean(),
    steps: t.Array(PlanStepSchema),
});
export type RewardPlan = Static<typeof RewardPlanSchema>;

export const RewardHistoryItemSchema = t.Object({
    /** The asset log's id: one settlement batch stamps the same `txHash` on many rewards. */
    id: t.String(),
    merchant: MerchantInfoSchema,
    token: TokenInfoSchema,
    amount: t.TokenAmount,
    status: RewardDisplayStatusSchema,
    role: AssetLogRecipientTypeSchema,
    trigger: InteractionTypeSchema,
    txHash: t.Optional(t.String()),
    createdAt: t.Date(),
    settledAt: t.Optional(t.Date()),
    /** Timestamp at which a locked reward becomes claimable. Undefined when no lockup. */
    availableAt: t.Optional(t.Date()),
    /** Set on a `locked` reward that waits on another user's mission (the referee's). */
    waitsOnFriend: t.Optional(t.Boolean()),
    /** Reason a `cancelled` reward was cancelled. Undefined for non-cancelled rewards. */
    cancellationReason: t.Optional(CancellationReasonSchema),
    purchase: t.Optional(PurchaseInfoSchema),
    /** Set when the item collapses the steps of a subscription campaign; `amount` is then the plan total. */
    plan: t.Optional(RewardPlanSchema),
});
export type RewardHistoryItem = Static<typeof RewardHistoryItemSchema>;

export const RewardHistoryResponseSchema = t.Object({
    items: t.Array(RewardHistoryItemSchema),
    totalCount: t.Number(),
});
export type RewardHistoryResponse = Static<typeof RewardHistoryResponseSchema>;
