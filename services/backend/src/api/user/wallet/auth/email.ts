import { sessionContext } from "@backend-infrastructure";
import { t } from "@backend-utils";
import { Elysia, status } from "elysia";
import { AuthContext } from "../../../../domain/auth";
import {
    AssociateEmailResponseSchema,
    MyEmailResponseSchema,
} from "../../../schemas";

/**
 * Post-auth email management for the *current* authenticator.
 *
 * Distinct from `/auth/emailStatus`, which is a pre-registration availability
 * check. Here we already know which credential the request belongs to
 * (via the wallet session), so the routes are scoped to "my" email.
 *
 * Only WebAuthn credentials carry an email today (ECDSA/distant sessions are
 * out of scope for recovery via email), so the routes silently treat any
 * non-webauthn session as "no email on file".
 */
export const emailRoutes = new Elysia({ prefix: "/email" })
    .use(sessionContext)
    .get(
        "/",
        async ({ walletSession }) => {
            if (walletSession.type === "ecdsa") {
                return { email: null };
            }
            const email = await AuthContext.repositories.authenticator.getEmail(
                walletSession.authenticatorId
            );
            return { email };
        },
        {
            withWalletAuthent: true,
            response: {
                401: t.String(),
                200: MyEmailResponseSchema,
            },
        }
    )
    .post(
        "/",
        async ({ walletSession, body: { email } }) => {
            if (walletSession.type === "ecdsa") {
                // No credential row to attach an email to. The UI shouldn't
                // surface the flow for ECDSA sessions, but guard anyway.
                return status(400, "Unsupported wallet type");
            }

            const credentialId = walletSession.authenticatorId;
            const normalized = email.trim().toLowerCase();

            // Refuse silent overwrite: the post-auth UI only exposes this when
            // no email is set, so reaching this with an existing email means
            // either a race or a stale client. Surface it so we don't lose data.
            const currentEmail =
                await AuthContext.repositories.authenticator.getEmail(
                    credentialId
                );
            if (currentEmail) {
                return {
                    status: "alreadyHasEmail" as const,
                    email: currentEmail,
                };
            }

            // Email already attached to a different credential -> defer to the
            // future merge flow. We still surface the existing wallet so the
            // UI can later propose a recovery-by-merge action.
            const existing =
                await AuthContext.repositories.authenticator.findByEmail(
                    normalized
                );
            if (existing && existing.authenticatorId !== credentialId) {
                return {
                    status: "conflict" as const,
                    authenticatorId: existing.authenticatorId,
                    wallet: existing.smartWalletAddress ?? undefined,
                };
            }

            const { updated } =
                await AuthContext.repositories.authenticator.updateEmail({
                    credentialId,
                    email: normalized,
                });
            if (!updated) {
                // Session pointed to a credential id with no matching row.
                // Shouldn't happen for an authenticated WebAuthn session, but
                // 404 maps better than a silent success.
                return status(404, "Authenticator not found");
            }

            return { status: "success" as const, email: normalized };
        },
        {
            withWalletAuthent: true,
            body: t.Object({
                email: t.String({ format: "email", maxLength: 320 }),
            }),
            response: {
                400: t.String(),
                401: t.String(),
                404: t.String(),
                200: AssociateEmailResponseSchema,
            },
        }
    );
