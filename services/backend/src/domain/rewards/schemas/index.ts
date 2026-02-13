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
]);
export type AssetStatus = Static<typeof AssetStatusSchema>;

export const AssetTypeSchema = t.Literal("token");
export type AssetType = Static<typeof AssetTypeSchema>;

export const RecipientTypeSchema = t.Union([
    t.Literal("referrer"),
    t.Literal("referee"),
]);
export type RecipientType = Static<typeof RecipientTypeSchema>;
