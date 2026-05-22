import { sessionContext } from "@backend-infrastructure";
import { t } from "@backend-utils";
import { Elysia, status } from "elysia";
import { AuthContext } from "../../../../domain/auth";
import { IdentityContext } from "../../../../domain/identity/context";
import { OrchestrationContext } from "../../../../orchestration/context";
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
    .get(
        "/",
        async ({ walletSession }) => {
            if (walletSession.type === "ecdsa") {
                return { email: null };
            }
            const group =
                await IdentityContext.repositories.identity.findGroupByIdentity(
                    { type: "wallet", value: walletSession.address }
                );
            if (!group) {
                return { email: null };
            }
            const email =
                await IdentityContext.repositories.identity.findEmailForGroup(
                    group.id
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
            const identityRepo = IdentityContext.repositories.identity;

            const walletGroup = await identityRepo.findGroupByIdentity({
                type: "wallet",
                value: walletSession.address,
            });
            if (!walletGroup) {
                return status(404, "Wallet identity not found");
            }

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
            // to the wallet-merge flow. Resolve the conflicting wallet + every
            // credential currently bound to it on the active chain so the UI
            // can pick one as the merge target / advertise the full list to a
            // login ceremony.
            const conflicting =
                await OrchestrationContext.orchestrators.authenticatorLookup.findByEmail(
                    email
                );
            if (conflicting && conflicting.groupId !== walletGroup.id) {
                return {
                    status: "conflict" as const,
                    authenticatorIds: conflicting.authenticatorIds,
                    wallet: conflicting.wallet,
                };
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
