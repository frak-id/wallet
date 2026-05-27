import type { MergeSettleResponse } from "@frak-labs/backend-elysia/api/schemas";
import {
    authenticatedWalletApi,
    authKey,
    type Session,
    sessionStore,
} from "@frak-labs/wallet-shared";
import { useMutation } from "@tanstack/react-query";
import { MergeError } from "../errors";

type UseMergeSettleArgs = {
    /**
     * Credential id of the OTHER wallet being merged with — the same value
     * originally passed to `/merge/preview` as `targetAuthenticatorId`,
     * **never** the backend-derived loser. The backend re-derives the
     * winner/loser decision server-side from this credential and the live
     * session, so the client cannot tamper with it.
     *
     * Sending the derived loser id here breaks the desktop-is-loser flow:
     * the requester (JWT) IS the loser, so `requesterAuthenticatorId ===
     * targetAuthenticatorId` and `preview()` throws `MERGE_SAME_CREDENTIAL`.
     */
    targetAuthenticatorId: string;
    /** Base64 webauthn assertion produced by `useLoserConsent`. */
    loserConsentSignature: string;
    /**
     * Pairing id used by the cross-device (Phase 2) merge flow. When
     * present, the backend pushes a `merge-completed` event on both
     * pairing topics after settlement — the loser-side payload carries a
     * freshly-minted webauthn session so the loser device can swap its
     * stale one without a separate login. Omitted for same-device merges.
     */
    pairingId?: string;
};

/**
 * POSTs to `/user/wallet/merge/settle`. No on-chain wait happens here:
 * `useSendAddPassKeyTx` owns the full "send + wait for chain finality"
 * pipeline (userOp receipt + ≥8 L2 confirmations + state-recheck
 * recovery), so by the time `SettlingStep` mounts the validator binding
 * is observable to the backend.
 *
 * On success the backend returns a fresh wallet session when the requester
 * authenticated with the loser credential (the credential's binding now
 * points at the winner wallet, so the previous JWT carries a stale
 * `address`). We apply that session directly via `setSession` /
 * `setSdkSession` so the user lands on a session that resolves to the
 * canonical wallet without a separate `/login` round-trip.
 *
 * Endpoint is idempotent — retrying with the same `(targetAuthenticatorId,
 * loserConsentSignature)` pair converges.
 */
export function useMergeSettle() {
    return useMutation<MergeSettleResponse, Error, UseMergeSettleArgs>({
        mutationKey: authKey.merge.settle,
        gcTime: 0,
        mutationFn: async ({
            targetAuthenticatorId,
            loserConsentSignature,
            pairingId,
        }) => {
            const { data, error } =
                await authenticatedWalletApi.merge.settle.post({
                    targetAuthenticatorId,
                    loserConsentSignature,
                    pairingId,
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

            return data;
        },
        onSuccess: (_data, _variable, _result, { client }) => {
            // The merge re-binds the credential to the winner wallet, so
            // any session-scoped caches that were populated against the
            // loser are now stale. `authKey.myEmail` is the obvious one
            // (the email the user just typed now lives on the winner),
            // but we also drop the merge-preview cache so a subsequent
            // attempt re-fetches against the new binding instead of
            // returning the now-meaningless pre-merge preview.
            client.invalidateQueries({ queryKey: authKey.myEmail });
            client.invalidateQueries({
                queryKey: [authKey.merge.settle[0], authKey.merge.settle[1]],
            });
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
    return MergeError.SettleFailed;
}
