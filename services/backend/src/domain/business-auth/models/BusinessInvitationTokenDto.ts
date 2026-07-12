import { t } from "@backend-utils";

/**
 * JWT payload for a merchant-team email invitation link.
 *
 * Signed with the same secret as the legacy `BusinessTokenDto` session JWT
 * (`JWT_BUSINESS_SECRET`) — the literal `typ` discriminator below is what
 * keeps the two token kinds from ever being accepted by each other's verify
 * path (`buildJwtContext.verify` only checks signature + schema shape, not
 * `iss`), since `BusinessTokenDto` has no `typ` field and this DTO has no
 * `wallet` field.
 */
export const BusinessInvitationTokenDto = t.Object({
    typ: t.Literal("business-invitation"),
    // The credential-less `business_accounts.id` pre-created for the
    // invitee — claim resolves/activates this exact row, never inserts one.
    sub: t.String({ format: "uuid" }),
    merchantId: t.String({ format: "uuid" }),
    email: t.String({ format: "email" }),
    // Null when the inviter authenticated via a legacy JWT session (no
    // `accountId`, wallet-only identity) — preview falls back to a generic
    // "a team admin" label in that case.
    invitedBy: t.Union([t.String({ format: "uuid" }), t.Null()]),
});
