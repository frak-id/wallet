import { t } from "@backend-utils";
import { EMAIL_VERIFICATION } from "@frak-labs/app-essentials/constants/emailVerification";
import type { Static } from "elysia";
import { conflictTargetFields } from "./authenticationSchemas";

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
    t.Object({ status: t.Literal("conflict"), ...conflictTargetFields }),
    t.Object({ status: t.Literal("unavailable") }),
]);
export type SendEmailVerificationResponse = Static<
    typeof SendEmailVerificationResponseSchema
>;

export const VerifyEmailBodySchema = t.Object({
    code: t.String({
        minLength: EMAIL_VERIFICATION.CODE_LENGTH,
        maxLength: EMAIL_VERIFICATION.CODE_LENGTH,
    }),
});
export type VerifyEmailBody = Static<typeof VerifyEmailBodySchema>;

export const VerifyEmailResponseSchema = t.Union([
    t.Object({
        status: t.Literal("verified"),
        email: t.String(),
        verifiedAt: t.String(),
    }),
    t.Object({ status: t.Literal("alreadyVerified"), email: t.String() }),
    // The address was claimed by another group between send and verify — the
    // user must merge rather than attach. Same shape the send/associate routes
    // surface so the client routes into the existing merge flow.
    t.Object({ status: t.Literal("conflict"), ...conflictTargetFields }),
    t.Object({ status: t.Literal("invalid") }),
    t.Object({ status: t.Literal("expired") }),
    t.Object({ status: t.Literal("tooManyAttempts") }),
]);
export type VerifyEmailResponse = Static<typeof VerifyEmailResponseSchema>;
