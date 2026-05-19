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
 * on-chain. The endpoint is idempotent — see
 * `WalletMergeOrchestrator.settle` for the per-step contract.
 *
 * The body carries `onChainTxHash`; the backend re-derives the rest of the
 * merge state from the (wallet session, target credential) pair so the
 * client cannot tamper with the winner/loser decision.
 */
export const mergeSettleRoutes = new Elysia().use(sessionContext).post(
    "/settle",
    async ({ walletSession, body }) => {
        if (!isLocalWebAuthnSession(walletSession)) {
            throw HttpError.badRequest(
                "MERGE_UNSUPPORTED_SESSION",
                "Wallet merge requires a local webauthn session (no ECDSA, no paired/distant sessions)"
            );
        }

        return OrchestrationContext.orchestrators.walletMerge.settle({
            requesterWallet: walletSession.address,
            requesterAuthenticatorId: walletSession.authenticatorId,
            targetAuthenticatorId: body.targetAuthenticatorId,
            onChainTxHash: body.onChainTxHash,
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

function isLocalWebAuthnSession(session: StaticWalletTokenDto): boolean {
    return session.type === undefined || session.type === "webauthn";
}
