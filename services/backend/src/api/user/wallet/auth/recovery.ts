import { sessionContext } from "@backend-infrastructure";
import { t } from "@backend-utils";
import { Elysia, status } from "elysia";
import { IdentityContext } from "../../../../domain/identity/context";
import {
    RecoveryBlobResponseSchema,
    RecoveryStatusResponseSchema,
    SaveRecoveryBlobBodySchema,
    SaveRecoveryResponseSchema,
} from "../../../schemas";

/**
 * Encrypted recovery backup for the *current* wallet.
 *
 * The blob is sealed client-side with the user's password; the backend is a
 * zero-knowledge store — it never receives the password and never decrypts.
 * Password verification happens entirely on the client (fetch `/blob`, decrypt,
 * check the AES-GCM tag), so there is intentionally no test-password endpoint.
 *
 * Anchored on the identity group like email (`wallet -> group -> recovery blob`).
 * Only WebAuthn credentials carry recovery; ECDSA/distant sessions resolve to
 * "no recovery".
 */
export const recoveryRoutes = new Elysia({ prefix: "/recovery" })
    .use(sessionContext)
    .get(
        "/",
        async ({ walletSession }) => {
            if (walletSession.type === "ecdsa") {
                return { configured: false };
            }
            const group =
                await IdentityContext.repositories.identity.findGroupByIdentity(
                    { type: "wallet", value: walletSession.address }
                );
            if (!group) {
                return { configured: false };
            }
            const recovery =
                await IdentityContext.repositories.recovery.findByGroup(
                    group.id
                );
            if (!recovery) {
                return { configured: false };
            }
            return {
                configured: true,
                createdAt: recovery.createdAt.toISOString(),
            };
        },
        {
            withWalletAuthent: true,
            response: {
                401: t.String(),
                200: RecoveryStatusResponseSchema,
            },
        }
    )
    .get(
        "/blob",
        async ({ walletSession }) => {
            if (walletSession.type === "ecdsa") {
                return { blob: null };
            }
            const group =
                await IdentityContext.repositories.identity.findGroupByIdentity(
                    { type: "wallet", value: walletSession.address }
                );
            if (!group) {
                return { blob: null };
            }
            const recovery =
                await IdentityContext.repositories.recovery.findByGroup(
                    group.id
                );
            return { blob: recovery?.blob ?? null };
        },
        {
            withWalletAuthent: true,
            response: {
                401: t.String(),
                200: RecoveryBlobResponseSchema,
            },
        }
    )
    .post(
        "/",
        async ({ walletSession, body: { blob } }) => {
            if (walletSession.type === "ecdsa") {
                return status(400, "Unsupported wallet type");
            }
            const group =
                await IdentityContext.repositories.identity.findGroupByIdentity(
                    { type: "wallet", value: walletSession.address }
                );
            if (!group) {
                return status(404, "Wallet identity not found");
            }

            const saved = await IdentityContext.repositories.recovery.save({
                groupId: group.id,
                blob,
            });
            if (!saved) {
                return { status: "alreadyConfigured" as const };
            }

            return { status: "success" as const };
        },
        {
            withWalletAuthent: true,
            body: SaveRecoveryBlobBodySchema,
            response: {
                400: t.String(),
                401: t.String(),
                404: t.String(),
                200: SaveRecoveryResponseSchema,
            },
        }
    );
