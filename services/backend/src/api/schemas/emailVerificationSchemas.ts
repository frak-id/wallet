import { t } from "@backend-utils";
import type { Static } from "elysia";

/**
 * Body for `POST /auth/email/verification`. An omitted `email` re-sends a code
 * to the group's current address; a supplied one starts a rotation to a new
 * address (verified only once the code is entered).
 */
export const SendEmailVerificationBodySchema = t.Object({
    email: t.Optional(t.String({ format: "email", maxLength: 320 })),
});
export type SendEmailVerificationBody = Static<
    typeof SendEmailVerificationBodySchema
>;

export const SendEmailVerificationResponseSchema = t.Union([
    t.Object({ status: t.Literal("sent") }),
    t.Object({ status: t.Literal("throttled"), retryAfterSec: t.Number() }),
    t.Object({
        status: t.Literal("conflict"),
        authenticatorIds: t.Array(t.String()),
        wallet: t.Optional(t.Address()),
    }),
]);
export type SendEmailVerificationResponse = Static<
    typeof SendEmailVerificationResponseSchema
>;

export const VerifyEmailBodySchema = t.Object({
    code: t.String({ minLength: 6, maxLength: 6 }),
});
export type VerifyEmailBody = Static<typeof VerifyEmailBodySchema>;

export const VerifyEmailResponseSchema = t.Union([
    t.Object({
        status: t.Literal("verified"),
        email: t.String(),
        verifiedAt: t.String(),
    }),
    t.Object({ status: t.Literal("alreadyVerified"), email: t.String() }),
    t.Object({ status: t.Literal("invalid") }),
    t.Object({ status: t.Literal("expired") }),
    t.Object({ status: t.Literal("tooManyAttempts") }),
]);
export type VerifyEmailResponse = Static<typeof VerifyEmailResponseSchema>;
