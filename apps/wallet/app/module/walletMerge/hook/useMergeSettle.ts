import type { MergeSettleResponse } from "@frak-labs/backend-elysia/api/schemas";
import {
    authenticatedWalletApi,
    authKey,
    sessionStore,
} from "@frak-labs/wallet-shared";
import { useMutation } from "@tanstack/react-query";
import type { Hex } from "viem";

type UseMergeSettleArgs = {
    /**
     * Credential id of the loser passkey — same value originally passed to
     * `/merge/preview` as `targetAuthenticatorId`. The backend re-derives the
     * winner/loser decision server-side from this credential and the live
     * session, so the client cannot tamper with it.
     */
    loserAuthenticatorId: string;
    /** Tx hash returned by {@link useSendAddPassKeyTx}. */
    onChainTxHash: Hex;
    /** Base64 webauthn assertion produced by `useLoserConsent`. */
    loserConsentSignature: string;
};

/**
 * POSTs to `/user/wallet/merge/settle` and, on success, drops the parked
 * snapshot of the original (loser) session.
 *
 * We deliberately do **not** restore the original session here: post-merge
 * the loser binding now points to the winner's wallet, so the loser JWT
 * still carries the loser's stale wallet address. Staying on the winner
 * session — which the SwitchStep already swapped in — gives the user a
 * coherent view of their now-canonical wallet. The rollback paths in
 * `MergeFlow` still call `popSession` for every non-success exit (aborts,
 * unmount) so cancelled merges always end up back on the original session.
 *
 * Endpoint is idempotent — retrying with the same `(loserAuthenticatorId,
 * onChainTxHash, loserConsentSignature)` triplet converges.
 */
export function useMergeSettle() {
    return useMutation<MergeSettleResponse, Error, UseMergeSettleArgs>({
        mutationKey: authKey.merge.settle,
        gcTime: 0,
        mutationFn: async ({
            loserAuthenticatorId,
            onChainTxHash,
            loserConsentSignature,
        }) => {
            const { data, error } =
                await authenticatedWalletApi.merge.settle.post({
                    targetAuthenticatorId: loserAuthenticatorId,
                    onChainTxHash,
                    loserConsentSignature,
                });
            if (error) {
                throw new Error(extractSettleErrorCode(error.value));
            }

            // Drop the parked snapshot now that the merge is durably
            // applied server-side. The live session is already the winner
            // (set by SwitchStep) — restoring the loser session here would
            // surface a stale wallet address. No-op when nothing was
            // parked (requester was already the winner before the flow).
            sessionStore.getState().discardPreviousSession();

            return data;
        },
    });
}

function extractSettleErrorCode(value: unknown): string {
    if (typeof value === "string") return value;
    if (
        value &&
        typeof value === "object" &&
        "code" in value &&
        typeof (value as { code: unknown }).code === "string"
    ) {
        return (value as { code: string }).code;
    }
    if (
        value &&
        typeof value === "object" &&
        "error" in value &&
        typeof (value as { error: unknown }).error === "string"
    ) {
        return (value as { error: string }).error;
    }
    return "MERGE_SETTLE_FAILED";
}
