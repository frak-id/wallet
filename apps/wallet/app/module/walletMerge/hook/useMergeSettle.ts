import type { MergeSettleResponse } from "@frak-labs/backend-elysia/api/schemas";
import {
    applyMergeSession,
    authenticatedWalletApi,
    authKey,
    balanceKey,
    claimableKey,
    mergeTokenKeys,
    pairingKey,
    referralKey,
    rewardsKey,
    type Session,
    sdkKey,
    sessionStore,
} from "@frak-labs/wallet-shared";
import { useMutation } from "@tanstack/react-query";
import { historyKey } from "@/module/history/queryKeys/history";
import { moneriumKey } from "@/module/monerium/queryKeys/monerium";
import { notificationKey } from "@/module/notification/queryKeys/notification";
import { recoveryKey } from "@/module/recovery/queryKeys/recovery";
import { recoverySetupKey } from "@/module/recovery-setup/queryKeys/recovery-setup";
import { MergeError } from "../errors";
import { walletMergeKey } from "../queryKeys/walletMerge";

type UseMergeSettleArgs = {
    /**
     * Credential id of the OTHER wallet — same value passed to
     * `/merge/preview`, never the backend-derived loser. Backend re-derives
     * winner/loser server-side, so the client can't tamper. Sending the
     * loser id here breaks desktop-is-loser: requester === target, so
     * `preview()` throws `MERGE_SAME_CREDENTIAL`.
     */
    targetAuthenticatorId: string;
    /** Base64 webauthn assertion produced by `useLoserConsent`. */
    loserConsentSignature: string;
    /**
     * Pairing id for the cross-device merge flow. When present, the backend
     * pushes a `merge-completed` event on both pairing topics after
     * settlement — the loser-side payload carries a fresh webauthn session
     * so that device can swap its stale one without a separate login.
     * Omitted for same-device merges.
     */
    pairingId?: string;
};

/**
 * POSTs to `/user/wallet/merge/settle`. No on-chain wait here:
 * `useSendAddPassKeyTx` owns the send+finality pipeline, so by the time
 * `SettlingStep` mounts the validator binding is already observable to
 * the backend.
 *
 * On success, a fresh session is returned when the requester authenticated
 * with the loser credential (its binding now points at the winner, so the
 * old JWT's `address` is stale). We apply it directly so the user lands on
 * the canonical wallet without a separate `/login`.
 *
 * Idempotent — retrying with the same `(targetAuthenticatorId,
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

            // Backend always mints a webauthn session for merge; the type
            // narrow keeps Eden's broader `WalletTokenDto` union from
            // leaking ecdsa/distant-webauthn shapes into local Session.
            if (data.session && data.session.type !== "ecdsa") {
                // Snapshot pre-merge address before swapping session:
                // `applyMergeSession` needs it to evict the orphan
                // loser-wallet entry from the IDB authenticator list.
                const previousAddress =
                    sessionStore.getState().session?.address;

                const { token, sdkJwt, type, ...rest } = data.session;
                const newSession = { ...rest, type, token } as Session;
                sessionStore.getState().setSession(newSession);
                sessionStore.getState().setSdkSession(sdkJwt);

                // Mirror useLogin's writes (last-auth store + IDB list +
                // recovery hint) so the rebound credential behaves like a fresh login.
                await applyMergeSession({
                    previousAddress,
                    session: newSession,
                });
            }

            return data;
        },
        onSuccess: (_data, _variable, _result, { client }) => {
            // Merge re-binds the loser credential to the winner wallet.
            // JWT-derived keys are invalidated to refetch under the new
            // binding; address-keyed entries are removed since the
            // loser-keyed cache would otherwise linger. Order doesn't matter.
            client.invalidateQueries({ queryKey: authKey.myEmail });
            client.invalidateQueries({
                queryKey: authKey.previousAuthenticators,
            });
            client.invalidateQueries({ queryKey: authKey.recoveryHint });
            client.invalidateQueries({ queryKey: authKey.merge.all });
            client.invalidateQueries({ queryKey: walletMergeKey.all });
            client.invalidateQueries({ queryKey: sdkKey.token.all });
            client.invalidateQueries({ queryKey: mergeTokenKeys.all });
            client.invalidateQueries({
                queryKey: notificationKey.push.backendToken,
            });
            client.invalidateQueries({ queryKey: moneriumKey.all });
            client.invalidateQueries({ queryKey: referralKey.all });

            client.removeQueries({ queryKey: balanceKey.baseKey });
            client.removeQueries({ queryKey: claimableKey.baseKey });
            client.removeQueries({ queryKey: rewardsKey.all });
            client.removeQueries({ queryKey: pairingKey.list.all });
            client.removeQueries({ queryKey: recoverySetupKey.all });
            client.removeQueries({ queryKey: recoveryKey.all });
            client.removeQueries({ queryKey: historyKey.all });
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
