import { t } from "@backend-utils";
import type { Static } from "elysia";

export const EmailStatusResponseSchema = t.Union([
    t.Object({ used: t.Literal(false) }),
    t.Object({
        used: t.Literal(true),
        authenticatorId: t.Optional(t.String()),
        wallet: t.Optional(t.Address()),
    }),
]);
export type EmailStatusResponse = Static<typeof EmailStatusResponseSchema>;

/**
 * Current authenticator's email status. Returned by the wallet "do I have an
 * email on file" check used to decide whether to offer the post-auth
 * "add my email" flow.
 */
export const MyEmailResponseSchema = t.Object({
    email: t.Union([t.String(), t.Null()]),
});
export type MyEmailResponse = Static<typeof MyEmailResponseSchema>;

/**
 * Result of an attempt to associate an email with the current authenticator.
 *
 * - `success`: email saved on the credential
 * - `alreadyHasEmail`: the credential already has an email; the caller should
 *   not silently overwrite (current UI only exposes the flow when missing)
 * - `conflict`: another wallet already owns this email — UI will eventually
 *   trigger the merge flow; for now it just surfaces a friendly error
 */
export const AssociateEmailResponseSchema = t.Union([
    t.Object({ status: t.Literal("success"), email: t.String() }),
    t.Object({ status: t.Literal("alreadyHasEmail"), email: t.String() }),
    t.Object({
        status: t.Literal("conflict"),
        authenticatorId: t.Optional(t.String()),
        wallet: t.Optional(t.Address()),
    }),
]);
export type AssociateEmailResponse = Static<
    typeof AssociateEmailResponseSchema
>;
