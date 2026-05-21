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
 * POSTs to `/user/wallet/merge/settle` and, on success, pops the parked
 * session so the user lands back on whichever credential they started from.
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

            // Restore the original session now that the merge is durably
            // applied server-side. No-op when nothing was parked (requester
            // was already the winner).
            sessionStore.getState().popSession();

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
