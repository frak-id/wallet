import { log, sessionContext } from "@backend-infrastructure";
import { t } from "@backend-utils";
import { Elysia } from "elysia";
import type { StaticWalletTokenDto } from "../../../../domain/auth";
import { IdentityContext } from "../../../../domain/identity/context";
import {
    DeleteRecoveryResponseSchema,
    RecoveryBlobResponseSchema,
    RecoveryStatusResponseSchema,
    RequestRecoveryEmailBodySchema,
    RequestRecoveryEmailResponseSchema,
    SaveRecoveryBlobBodySchema,
    SaveRecoveryResponseSchema,
} from "../../../schemas";
import { walletGroupContext } from "./walletGroupContext";

/**
 * Resolve the stored recovery blob row for a session, degrading to `null` for
 * ECDSA sessions and wallets without an identity group (the read routes answer
 * "not configured" rather than erroring, mirroring `GET /email`).
 */
async function findRecoveryForSession(walletSession: StaticWalletTokenDto) {
    if (walletSession.type === "ecdsa") {
        return null;
    }
    const group =
        await IdentityContext.repositories.identity.findGroupByIdentity({
            type: "wallet",
            value: walletSession.address,
        });
    if (!group) {
        return null;
    }
    return IdentityContext.repositories.recovery.findByGroup(group.id);
}

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
    .use(walletGroupContext)
    .get(
        "/",
        async ({ walletSession }) => ({
            configured: !!(await findRecoveryForSession(walletSession)),
        }),
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
        async ({ walletSession }) => ({
            blob: (await findRecoveryForSession(walletSession))?.blob ?? null,
        }),
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
        async ({ walletGroup, body: { blob } }) => {
            await IdentityContext.repositories.recovery.save({
                groupId: walletGroup.id,
                blob,
            });

            return { status: "success" as const };
        },
        {
            withWalletGroup: true,
            body: SaveRecoveryBlobBodySchema,
            response: {
                400: t.String(),
                401: t.String(),
                404: t.String(),
                200: SaveRecoveryResponseSchema,
            },
        }
    )
    .delete(
        "/",
        async ({ walletGroup }) => {
            await IdentityContext.repositories.recovery.deleteByGroup(
                walletGroup.id
            );

            return { status: "deleted" as const };
        },
        {
            withWalletGroup: true,
            response: {
                400: t.String(),
                401: t.String(),
                404: t.String(),
                200: DeleteRecoveryResponseSchema,
            },
        }
    )
    // Intentionally public (no `withWalletAuthent`): a logged-out user requests
    // their backup by email. The ack is identical whether or not the address is
    // recoverable, so this never reveals account existence. Fire-and-forget:
    // responding before the lookup + send keeps the response time flat, so an
    // attacker can't infer eligibility from latency either.
    .post(
        "/request",
        ({ body: { email } }) => {
            IdentityContext.services.recoveryEmail
                .requestRecoveryEmail(email)
                .catch((err) =>
                    log.error({ err }, "Recovery email request failed")
                );
            return { status: "requested" as const };
        },
        {
            body: RequestRecoveryEmailBodySchema,
            response: {
                200: RequestRecoveryEmailResponseSchema,
            },
        }
    );
