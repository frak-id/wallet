import { t } from "@backend-utils";
import type { Static } from "elysia";

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

/**
 * Set together with `removed_at` when an active referral link goes inactive.
 *  - `removed`: end-user revoked the attribution (DELETE /referral/redemption).
 *  - `merged`: `IdentityMergeService` collapsed the row during a merge.
 */
export const ReferralLinkEndReasonSchema = t.Union([
    t.Literal("removed"),
    t.Literal("merged"),
]);
export type ReferralLinkEndReason = Static<typeof ReferralLinkEndReasonSchema>;

/**
 * Per-source metadata captured when the referral edge was created.
 *  - `link.sharedAt`: the referrer's link-creation timestamp embedded in the
 *    share URL, used to join back to the originating `create_referral_link`.
 *  - `code.codeId`: the `referral_codes` row that was redeemed.
 */
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
