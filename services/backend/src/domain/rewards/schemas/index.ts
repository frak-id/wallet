import { t } from "@backend-utils";
import type { Static } from "elysia";

// =============================================================================
// INTERACTION TYPE SCHEMA
// =============================================================================
// Unified schema for both interaction logs AND campaign triggers
// =============================================================================

export const InteractionTypeSchema = t.Union([
    t.Literal("referral"),
    t.Literal("create_referral_link"),
    t.Literal("purchase"),
    t.Literal("custom"),
]);
export type InteractionType = Static<typeof InteractionTypeSchema>;

// =============================================================================
// ASSET LOG SCHEMAS
// =============================================================================

export const AssetStatusSchema = t.Union([
    t.Literal("pending"),
    t.Literal("processing"),
    t.Literal("settled"),
    t.Literal("consumed"),
    t.Literal("cancelled"),
    t.Literal("expired"),
    t.Literal("bank_depleted"),
]);
export type AssetStatus = Static<typeof AssetStatusSchema>;

export const AssetTypeSchema = t.Literal("token");
export type AssetType = Static<typeof AssetTypeSchema>;

export const RecipientTypeSchema = t.Union([
    t.Literal("referrer"),
    t.Literal("referee"),
]);
export type RecipientType = Static<typeof RecipientTypeSchema>;

// =============================================================================
// REWARD HISTORY SCHEMAS
// =============================================================================

const MerchantInfoSchema = t.Object({
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

export const RewardHistoryItemSchema = t.Object({
    merchant: MerchantInfoSchema,
    token: TokenInfoSchema,
    amount: t.TokenAmount,
    status: AssetStatusSchema,
    role: RecipientTypeSchema,
    trigger: InteractionTypeSchema,
    txHash: t.Optional(t.String()),
    createdAt: t.Date(),
    settledAt: t.Optional(t.Date()),
    purchase: t.Optional(PurchaseInfoSchema),
});
export type RewardHistoryItem = Static<typeof RewardHistoryItemSchema>;

export const RewardHistoryResponseSchema = t.Object({
    items: t.Array(RewardHistoryItemSchema),
    totalCount: t.Number(),
});
export type RewardHistoryResponse = Static<typeof RewardHistoryResponseSchema>;
