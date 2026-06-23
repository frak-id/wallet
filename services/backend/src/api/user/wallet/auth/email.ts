import { sessionContext } from "@backend-infrastructure";
import { t } from "@backend-utils";
import { Elysia } from "elysia";
import { IdentityContext } from "../../../../domain/identity/context";
import { OrchestrationContext } from "../../../../orchestration/context";
import {
    MyEmailResponseSchema,
    SendEmailVerificationBodySchema,
    SendEmailVerificationResponseSchema,
    VerifyEmailBodySchema,
    VerifyEmailResponseSchema,
} from "../../../schemas";
import { walletGroupContext } from "./walletGroupContext";

/**
 * Map an email-availability resolution to the response shape shared by the
 * verification routes: a merge target becomes the `conflict` payload (wallet +
 * credentials), a retired address becomes `unavailable`, and a free or
 * own-group address yields `null` so the caller proceeds.
 */
async function checkEmailAvailability(email: string, walletGroupId: string) {
    const resolution =
        await OrchestrationContext.orchestrators.authenticatorLookup.resolveEmail(
            email,
            walletGroupId
        );
    if (resolution.status === "merge") {
        return {
            status: "conflict" as const,
            authenticatorIds: resolution.authenticatorIds,
            wallet: resolution.wallet,
        };
    }
    if (resolution.status === "unavailable") {
        return { status: "unavailable" as const };
    }
    return null;
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
        "/verification",
        async ({ walletGroup, body: { email } }) => {
            const identityRepo = IdentityContext.repositories.identity;

            if (email) {
                // Target must be free: another group owns it (-> merge
                // conflict) or it was retired (-> unavailable).
                const blocked = await checkEmailAvailability(
                    email,
                    walletGroup.id
                );
                if (blocked) {
                    return blocked;
                }

                // First email for the group: materialise the unverified node
                // now so the wallet immediately reflects "email on file" and a
                // later resend can resolve the target. A rotation (the group
                // already has a linked email) keeps the new address on the
                // challenge row only, attached on verify.
                const current = await identityRepo.findLinkedEmail(
                    walletGroup.id
                );
                if (!current) {
                    await identityRepo.addNode({
                        groupId: walletGroup.id,
                        type: "email",
                        value: email,
                    });
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
            // Re-resolve into the merge-capable payload the client handles; if
            // it is no longer an active foreign group (resolved free, or now
            // retired), fall back to `invalid` so the client retries.
            if (result.status === "conflict") {
                const blocked = await checkEmailAvailability(
                    result.email,
                    walletGroup.id
                );
                return blocked?.status === "conflict"
                    ? blocked
                    : { status: "invalid" as const };
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
