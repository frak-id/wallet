import { sessionContext } from "@backend-infrastructure";
import { HttpError, t } from "@backend-utils";
import { Elysia } from "elysia";
import type { StaticWalletTokenDto } from "../../../../domain/auth/models/WalletSessionDto";
import { OrchestrationContext } from "../../../../orchestration/context";
import { MergePreviewQuerySchema, MergePreviewSchema } from "../../../schemas";

/**
 * Read-only recap of the merge that would happen if the current wallet
 * session collapsed into the credential identified by `targetAuthenticatorId`.
 *
 * Returns the deterministic winner/loser decision and the loser's on-chain
 * public key, so the wallet can:
 *  - render the recap UI ("you'll gain N referrals…"),
 *  - know which credential needs to sign the `addPassKey` userOp on-chain,
 *  - decide whether the local fast-path applies (loser passkey is locally
 *    usable) or the user must use their other device (Phase 2).
 *
 * No side effects — settle() is responsible for repointing the binding and
 * collapsing the identity graphs.
 */
export const mergePreviewRoutes = new Elysia().use(sessionContext).get(
    "/preview",
    async ({ walletSession, query }) => {
        if (!isLocalWebAuthnSession(walletSession)) {
            throw HttpError.badRequest(
                "MERGE_UNSUPPORTED_SESSION",
                "Wallet merge requires a local webauthn session (no ECDSA, no paired/distant sessions)"
            );
        }

        return await OrchestrationContext.orchestrators.walletMerge.preview({
            requesterWallet: walletSession.address,
            requesterAuthenticatorId: walletSession.authenticatorId,
            targetAuthenticatorId: query.targetAuthenticatorId,
        });
    },
    {
        withWalletAuthent: true,
        query: MergePreviewQuerySchema,
        response: {
            400: t.ErrorResponse,
            401: t.String(),
            404: t.ErrorResponse,
            409: t.ErrorResponse,
            200: MergePreviewSchema,
        },
    }
);

function isLocalWebAuthnSession(session: StaticWalletTokenDto): boolean {
    // The session type is optional on the webauthn variant (default). A
    // distant-webauthn session carries `type: "distant-webauthn"` and an
    // ecdsa session carries `type: "ecdsa"` — both are explicitly rejected.
    return session.type === undefined || session.type === "webauthn";
}
