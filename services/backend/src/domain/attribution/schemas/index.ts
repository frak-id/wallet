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

export const ReferralLinkSourceDataSchema = t.Union([
    t.Object({
        type: t.Literal("referral_link"),
        v: t.Union([t.Literal(1), t.Undefined(), t.Null()]),
        referrerWallet: t.Hex(),
    }),
    t.Object({
        type: t.Literal("referral_link"),
        v: t.Literal(2),
        referrerClientId: t.String(),
        referrerMerchantId: t.String(),
        referralTimestamp: t.Optional(t.Number()),
    }),
]);
export type ReferralLinkSourceData = Static<
    typeof ReferralLinkSourceDataSchema
>;

export const OrganicSourceDataSchema = t.Object({
    type: t.Literal("organic"),
});
export type OrganicSourceData = Static<typeof OrganicSourceDataSchema>;

export const PaidAdSourceDataSchema = t.Object({
    type: t.Literal("paid_ad"),
    utmSource: t.Optional(t.String()),
    utmMedium: t.Optional(t.String()),
    utmCampaign: t.Optional(t.String()),
    utmTerm: t.Optional(t.String()),
    utmContent: t.Optional(t.String()),
});
export type PaidAdSourceData = Static<typeof PaidAdSourceDataSchema>;

export const DirectSourceDataSchema = t.Object({
    type: t.Literal("direct"),
});
export type DirectSourceData = Static<typeof DirectSourceDataSchema>;

export const TouchpointSourceDataSchema = t.Union([
    ReferralLinkSourceDataSchema,
    OrganicSourceDataSchema,
    PaidAdSourceDataSchema,
    DirectSourceDataSchema,
]);
export type TouchpointSourceData = Static<typeof TouchpointSourceDataSchema>;
