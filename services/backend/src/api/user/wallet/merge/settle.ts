import { sessionContext } from "@backend-infrastructure";
import { HttpError, t } from "@backend-utils";
import { Elysia } from "elysia";
import type { StaticWalletTokenDto } from "../../../../domain/auth/models/WalletSessionDto";
import { OrchestrationContext } from "../../../../orchestration/context";
import {
    MergeSettleBodySchema,
    MergeSettleResponseSchema,
} from "../../../schemas";

/**
 * Finalise a wallet merge after the user has signed the `addPassKey` userOp
 * on-chain AND the frontend has confirmed the receipt landed. The endpoint
 * is idempotent — see `WalletMergeOrchestrator.settle` for the per-step
 * contract.
 *
 * The backend re-derives the merge state from the (wallet session, target
 * credential) pair so the client cannot tamper with the winner/loser
 * decision. The on-chain landed check is the validator readback at step 2,
 * which already proves the userOp was applied (no separate tx-hash needed).
 *
 * Session gate: any webauthn session (local OR distant) is accepted —
 * Phase 2 lets the desktop call this endpoint with a distant-webauthn JWT
 * when it tunnels signing through a paired mobile. The crypto proof is
 * identical (the userOp was still signed by the winner's passkey, the
 * loser-consent assertion was still produced by the loser's passkey).
 * Only ECDSA sessions stay excluded.
 */
export const mergeSettleRoutes = new Elysia().use(sessionContext).post(
    "/settle",
    async ({ walletSession, body }) => {
        if (isEcdsaSession(walletSession)) {
            throw HttpError.badRequest(
                "MERGE_UNSUPPORTED_SESSION",
                "Wallet merge requires a webauthn session (ECDSA sessions are not allowed)"
            );
        }

        return OrchestrationContext.orchestrators.walletMerge.settle({
            requesterWallet: walletSession.address,
            requesterAuthenticatorId: walletSession.authenticatorId,
            targetAuthenticatorId: body.targetAuthenticatorId,
            loserConsentSignature: body.loserConsentSignature,
            pairingId: body.pairingId,
        });
    },
    {
        withWalletAuthent: true,
        body: MergeSettleBodySchema,
        response: {
            400: t.ErrorResponse,
            401: t.String(),
            404: t.ErrorResponse,
            409: t.ErrorResponse,
            422: t.ErrorResponse,
            200: MergeSettleResponseSchema,
        },
    }
);

function isEcdsaSession(session: StaticWalletTokenDto): boolean {
    return session.type === "ecdsa";
}
