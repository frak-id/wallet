import { t } from "@backend-utils";
import type { Static } from "elysia";

// =============================================================================
// INTERACTION LOG SCHEMAS
// =============================================================================

export const InteractionTypeSchema = t.Union([
    t.Literal("referral_arrival"),
    t.Literal("create_referral_link"),
    t.Literal("purchase"),
    t.Literal("wallet_connect"),
    t.Literal("identity_merge"),
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
]);
export type AssetStatus = Static<typeof AssetStatusSchema>;

export const AssetTypeSchema = t.Literal("token");
export type AssetType = Static<typeof AssetTypeSchema>;

export const RecipientTypeSchema = t.Union([
    t.Literal("referrer"),
    t.Literal("referee"),
    t.Literal("user"),
]);
export type RecipientType = Static<typeof RecipientTypeSchema>;
