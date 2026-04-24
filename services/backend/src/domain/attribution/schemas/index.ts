import { t } from "@backend-utils";
import type { Static } from "elysia";

// =============================================================================
// TOUCHPOINT SOURCE SCHEMAS
// =============================================================================

export const TouchpointSourceSchema = t.Union([
    t.Literal("referral_link"),
    t.Literal("organic"),
    t.Literal("paid_ad"),
    t.Literal("direct"),
]);
export type TouchpointSource = Static<typeof TouchpointSourceSchema>;

// =============================================================================
// TOUCHPOINT SOURCE DATA SCHEMAS (Discriminated Union)
// =============================================================================

const ReferralLinkSourceDataSchema = t.Union([
    t.Object({
        type: t.Literal("referral_link"),
        v: t.Union([t.Literal(1), t.Undefined(), t.Null()]),
        referrerWallet: t.Hex(),
    }),
    t.Object({
        type: t.Literal("referral_link"),
        v: t.Literal(2),
        referrerMerchantId: t.String(),
        referralTimestamp: t.Optional(t.Number()),
        // At least one of referrerClientId / referrerWallet must be present.
        // Enforced in the handler rather than at the schema level because
        // TypeBox unions on the same discriminator get brittle to refine.
        referrerClientId: t.Optional(t.String()),
        referrerWallet: t.Optional(t.Hex()),
    }),
]);

const OrganicSourceDataSchema = t.Object({
    type: t.Literal("organic"),
});

const PaidAdSourceDataSchema = t.Object({
    type: t.Literal("paid_ad"),
    utmSource: t.Optional(t.String()),
    utmMedium: t.Optional(t.String()),
    utmCampaign: t.Optional(t.String()),
    utmTerm: t.Optional(t.String()),
    utmContent: t.Optional(t.String()),
});

const DirectSourceDataSchema = t.Object({
    type: t.Literal("direct"),
});

export const TouchpointSourceDataSchema = t.Union([
    ReferralLinkSourceDataSchema,
    OrganicSourceDataSchema,
    PaidAdSourceDataSchema,
    DirectSourceDataSchema,
]);
export type TouchpointSourceData = Static<typeof TouchpointSourceDataSchema>;

// =============================================================================
// REFERRAL LINK SCHEMAS
// =============================================================================

export const ReferralLinkScopeSchema = t.Union([
    t.Literal("merchant"),
    t.Literal("cross_merchant"),
]);
export type ReferralLinkScope = Static<typeof ReferralLinkScopeSchema>;

// 'coupon' is reserved for the future merchant coupon feature (order rebate
// + referral registration). Not used by Phase 1 referral-code redemption.
export const ReferralLinkSourceSchema = t.Union([
    t.Literal("link"),
    t.Literal("code"),
    t.Literal("coupon"),
]);
export type ReferralLinkSource = Static<typeof ReferralLinkSourceSchema>;
