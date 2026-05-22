import type { MergeSettleResponse } from "@frak-labs/backend-elysia/api/schemas";
import {
    authenticatedWalletApi,
    authKey,
    currentViemClient,
    type Session,
    sessionStore,
} from "@frak-labs/wallet-shared";
import { useMutation } from "@tanstack/react-query";
import type { Hex } from "viem";
import { waitForTransactionReceipt } from "viem/actions";

type UseMergeSettleArgs = {
    /**
     * Credential id of the loser passkey — same value originally passed to
     * `/merge/preview` as `targetAuthenticatorId`. The backend re-derives the
     * winner/loser decision server-side from this credential and the live
     * session, so the client cannot tamper with it.
     */
    loserAuthenticatorId: string;
    /** Tx hash returned by {@link useSendAddPassKeyTx}. The hook waits for
     *  this receipt with ≥8 confirmations before POSTing to settle, so the
     *  backend only needs the validator readback to confirm the merge. */
    onChainTxHash?: Hex;
    /** Base64 webauthn assertion produced by `useLoserConsent`. */
    loserConsentSignature: string;
};

/**
 * Waits for the `addPassKey` tx receipt (≥8 confirmations) then POSTs to
 * `/user/wallet/merge/settle`. The on-chain wait is bundled here so callers
 * get a single mutation covering the whole finalise pipeline — retries
 * re-run wait + post against the same invariant inputs.
 *
 * On success the backend returns a fresh wallet session when the requester
 * authenticated with the loser credential (the credential's binding now
 * points at the winner wallet, so the previous JWT carries a stale
 * `address`). We apply that session directly via `setSession` /
 * `setSdkSession` so the user lands on a session that resolves to the
 * canonical wallet without a separate `/login` round-trip.
 *
 * The parked snapshot from {@link useSwitchAuthenticator} is discarded
 * unconditionally on success — the merge is durable, no path remains where
 * restoring the loser snapshot is desirable. The rollback paths in
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
            if (onChainTxHash && onChainTxHash !== "0x") {
                const receipt = await waitForTransactionReceipt(
                    currentViemClient,
                    {
                        hash: onChainTxHash,
                        confirmations: 8,
                    }
                );
                if (receipt.status !== "success") {
                    throw new Error("MERGE_USER_OP_REVERTED");
                }
            }

            const { data, error } =
                await authenticatedWalletApi.merge.settle.post({
                    targetAuthenticatorId: loserAuthenticatorId,
                    loserConsentSignature,
                });
            if (error) {
                throw new Error(extractSettleErrorCode(error.value));
            }

            // Apply the freshly minted session when the backend returned
            // one (requester authenticated with the loser credential). The
            // backend always mints a webauthn session for merge — the
            // narrow here keeps Eden's broader `WalletTokenDto` union from
            // leaking ecdsa/distant-webauthn shapes into our local Session
            // store, which only accepts local webauthn sessions in this
            // path.
            if (data.session && data.session.type !== "ecdsa") {
                const { token, sdkJwt, type, ...rest } = data.session;
                sessionStore
                    .getState()
                    .setSession({ ...rest, type, token } as Session);
                sessionStore.getState().setSdkSession(sdkJwt);
            }

            // Drop the parked snapshot now that the merge is durably
            // applied server-side. No-op when nothing was parked (requester
            // was already the winner before the flow).
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
