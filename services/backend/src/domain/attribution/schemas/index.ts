import { t } from "@backend-utils";
import type { Static } from "elysia";

// =============================================================================
// REFERRAL LINK SCHEMAS
// =============================================================================

export const ReferralLinkScopeSchema = t.Union([
    t.Literal("merchant"),
    t.Literal("cross_merchant"),
]);
export type ReferralLinkScope = Static<typeof ReferralLinkScopeSchema>;

export const ReferralLinkSourceSchema = t.Union([
    t.Literal("link"),
    t.Literal("code"),
]);
export type ReferralLinkSource = Static<typeof ReferralLinkSourceSchema>;

// =============================================================================
// REFERRAL LINK SOURCE DATA (Discriminated Union)
// =============================================================================
//
// Per-source metadata captured at the moment the referral edge was created.
//   - `link`: arrival from a shared link click. `sharedAt` is the
//     referrer's link-creation timestamp embedded in the share URL — used
//     to join back to the originating `create_referral_link` interaction
//     (e.g. for "this reward came from your share of purchase X").
//   - `code`: arrival from redeeming a referral code. `codeId` points to
//     the `referral_codes` row that was redeemed.

const LinkSourceDataSchema = t.Object({
    type: t.Literal("link"),
    sharedAt: t.Optional(t.Number()),
});

const CodeSourceDataSchema = t.Object({
    type: t.Literal("code"),
    codeId: t.String({ format: "uuid" }),
});

export const ReferralLinkSourceDataSchema = t.Union([
    LinkSourceDataSchema,
    CodeSourceDataSchema,
]);
export type ReferralLinkSourceData = Static<
    typeof ReferralLinkSourceDataSchema
>;
