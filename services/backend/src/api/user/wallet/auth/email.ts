import { sessionContext } from "@backend-infrastructure";
import { t } from "@backend-utils";
import { Elysia, status } from "elysia";
import { AuthContext } from "../../../../domain/auth";
import { IdentityContext } from "../../../../domain/identity/context";
import { OrchestrationContext } from "../../../../orchestration/context";
import {
    AssociateEmailResponseSchema,
    MyEmailResponseSchema,
    SendEmailVerificationBodySchema,
    SendEmailVerificationResponseSchema,
    VerifyEmailBodySchema,
    VerifyEmailResponseSchema,
} from "../../../schemas";
import { walletGroupContext } from "./walletGroupContext";

/**
 * Resolve whether `email` is already owned by a *different* identity group.
 * Returns the `conflict` payload the merge UI consumes (the conflicting wallet
 * + its active-chain credentials), or `null` when the address is free or
 * already sits on the caller's own group. Shared by the associate and the
 * verification routes so both surface an identical conflict shape.
 */
async function findEmailConflict(email: string, walletGroupId: string) {
    const conflicting =
        await OrchestrationContext.orchestrators.authenticatorLookup.findByEmail(
            email
        );
    if (!conflicting || conflicting.groupId === walletGroupId) {
        return null;
    }
    return {
        status: "conflict" as const,
        authenticatorIds: conflicting.authenticatorIds,
        wallet: conflicting.wallet,
    };
}

/**
 * Post-auth email management for the *current* authenticator.
 *
 * Distinct from `/auth/emailStatus`, which is a pre-registration availability
 * check. Here we already know which credential the request belongs to
 * (via the wallet session), so the routes are scoped to "my" email.
 *
 * Email is stored as a dedicated identity node on the wallet's identity group
 * (postgres), not on the libSQL authenticator binding. Lookups therefore
 * resolve `wallet → group → email node`.
 *
 * Only WebAuthn credentials carry an email today (ECDSA/distant sessions are
 * out of scope for recovery via email), so the routes silently treat any
 * non-webauthn session as "no email on file".
 */
export const emailRoutes = new Elysia({ prefix: "/email" })
    .use(sessionContext)
    .use(walletGroupContext)
    .get(
        "/",
        async ({ walletSession }) => {
            if (walletSession.type === "ecdsa") {
                return { email: null, verified: false, verifiedAt: null };
            }
            const group =
                await IdentityContext.repositories.identity.findGroupByIdentity(
                    { type: "wallet", value: walletSession.address }
                );
            if (!group) {
                return { email: null, verified: false, verifiedAt: null };
            }
            const emailStatus =
                await IdentityContext.services.emailVerification.getEmailStatus(
                    group.id
                );
            return {
                email: emailStatus.email,
                verified: emailStatus.verifiedAt !== null,
                verifiedAt: emailStatus.verifiedAt?.toISOString() ?? null,
                pendingEmail: emailStatus.pendingEmail,
            };
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
        async ({ walletSession, walletGroup, body: { email } }) => {
            const credentialId = walletSession.authenticatorId;
            const identityRepo = IdentityContext.repositories.identity;

            // Refuse silent overwrite: the post-auth UI only exposes this when
            // no email is set, so reaching this with an existing email means
            // either a race or a stale client. Surface it so we don't lose data.
            const currentEmail = await identityRepo.findEmailForGroup(
                walletGroup.id
            );
            if (currentEmail) {
                return {
                    status: "alreadyHasEmail" as const,
                    email: currentEmail,
                };
            }

            // Email already attached to a different identity group -> defer
            // to the wallet-merge flow.
            const conflict = await findEmailConflict(email, walletGroup.id);
            if (conflict) {
                return conflict;
            }

            // Authenticated credential must still exist — otherwise the wallet
            // session is dangling and `getByCredentialId` will return null. We
            // keep the historical 404 to distinguish a missing credential
            // from a successful update.
            const credential =
                await AuthContext.repositories.authenticator.getByCredentialId(
                    credentialId
                );
            if (!credential) {
                return status(404, "Authenticator not found");
            }

            await identityRepo.addNode({
                groupId: walletGroup.id,
                type: "email",
                value: email,
            });

            return {
                status: "success" as const,
                email: email.trim().toLowerCase(),
            };
        },
        {
            withWalletGroup: true,
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
    )
    .post(
        "/verification",
        async ({ walletGroup, body: { email } }) => {
            // Rotation conflict: another group owns it -> defer to merge flow.
            if (email) {
                const conflict = await findEmailConflict(email, walletGroup.id);
                if (conflict) {
                    return conflict;
                }
            }

            return IdentityContext.services.emailVerification.sendCode({
                groupId: walletGroup.id,
                email,
            });
        },
        {
            withWalletGroup: true,
            body: SendEmailVerificationBodySchema,
            response: {
                400: t.String(),
                401: t.String(),
                404: t.String(),
                200: SendEmailVerificationResponseSchema,
            },
        }
    )
    .post(
        "/verify",
        async ({ walletGroup, body: { code } }) => {
            const result =
                await IdentityContext.services.emailVerification.verifyCode({
                    groupId: walletGroup.id,
                    code,
                });

            // The address was claimed by another group between send and verify.
            // Enrich the bare conflict into the merge-capable payload the client
            // already handles; if it resolved free again (rare), fall back to
            // `invalid` so the client retries rather than showing a stale target.
            if (result.status === "conflict") {
                const conflict = await findEmailConflict(
                    result.email,
                    walletGroup.id
                );
                return conflict ?? { status: "invalid" as const };
            }

            return result;
        },
        {
            withWalletGroup: true,
            body: VerifyEmailBodySchema,
            response: {
                400: t.String(),
                401: t.String(),
                404: t.String(),
                200: VerifyEmailResponseSchema,
            },
        }
    );
