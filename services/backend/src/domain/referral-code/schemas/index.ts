import { t } from "@backend-utils";
import type { Static } from "elysia";

/**
 * `user`: the owner's single self-issued code.
 * `frak`: marketing code owned by the Frak identity, redeemable during onboarding only.
 */
export const ReferralCodeKindSchema = t.Union([
    t.Literal("user"),
    t.Literal("frak"),
]);
export type ReferralCodeKind = Static<typeof ReferralCodeKindSchema>;

/** Client intent flag on `/code/redeem`; only the onboarding step sends it. */
export const RedeemContextSchema = t.Literal("onboarding");
export type RedeemContext = Static<typeof RedeemContextSchema>;
