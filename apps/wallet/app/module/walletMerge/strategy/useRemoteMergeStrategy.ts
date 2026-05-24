import {
    buildMergeConsentChallenge,
    formatMergeConsentHourSlot,
} from "@frak-labs/app-essentials";
import {
    authKey,
    detachedPairingSessionStore,
    getOriginPairingClient,
} from "@frak-labs/wallet-shared";
import { useMutation } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { stringToHex } from "viem";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import type { LoserConsentResult } from "../hook/useLoserConsent";
import { useMigrateLoserAssets } from "../hook/useMigrateLoserAssets";
import { useSendAddPassKeyTx } from "../hook/useSendAddPassKeyTx";
import { signMergeConsentLocally } from "../utils/signMergeConsentLocally";
import type {
    LoserConsentArgs,
    LoserConsentMutation,
    MergeStrategy,
    RemotePairingSlice,
} from "./types";

type UseRemoteMergeStrategyArgs = {
    /**
     * `true` when desktop is the loser (mobile holds the winner passkey) —
     * pairing must ferry the winner's addPassKey signing through to mobile.
     * `false` when desktop is the winner (mobile holds the loser passkey) —
     * pairing ferries the loser's consent + asset-migration signing through
     * to mobile while addPassKey signs locally.
     * `undefined` while preview is still loading; the returned mutations
     * throw if invoked before this resolves.
     */
    needsSwitch: boolean | undefined;
    /** Credential id of the winner passkey (from preview). */
    winnerAuthenticatorId: string | undefined;
    /** Credential id of the loser passkey (from preview). */
    loserAuthenticatorId: string | undefined;
};

/**
 * Cross-device merge strategy backed by the existing `OriginPairingClient`.
 *
 * The pairing is opened in detached mode — the minted distant-webauthn
 * session is stashed in `detachedPairingSessionStore` rather than the live
 * `sessionStore`, so the user's normal app session stays intact while the
 * paired credential signs cross-device merge ceremonies in the background.
 * The pairing client is purely a signing transport for whichever credential
 * is not physically on this device. Transport selection per mutation:
 *
 *  | needsSwitch | who is on mobile | sendAddPassKey | migrateLoserAssets | loserConsent |
 *  |-------------|------------------|----------------|--------------------|--------------|
 *  | true        | winner           | paired         | local              | local        |
 *  | false       | loser            | local          | paired             | paired       |
 *
 * The hint passed to `initiatePairing` always points at the credential we
 * expect the mobile to authenticate as — i.e. the credential that is NOT
 * on this desktop. Backend's `handleJoinRequest` rejects any joiner that
 * doesn't match.
 */
export function useRemoteMergeStrategy({
    needsSwitch,
    winnerAuthenticatorId,
    loserAuthenticatorId,
}: UseRemoteMergeStrategyArgs): MergeStrategy {
    const client = useMemo(() => getOriginPairingClient(), []);
    const pairingState = useStore(
        client.store,
        useShallow(
            (state): RemotePairingSlice => ({
                pairing: state.pairing,
                status: state.status,
            })
        )
    );
    const pairingId = pairingState.pairing?.id;

    // Credential the mobile is expected to hold. Derived from `needsSwitch`:
    // when desktop is loser, mobile holds the winner; when desktop is
    // winner, mobile holds the loser.
    const remoteCredentialId =
        needsSwitch === undefined
            ? undefined
            : needsSwitch
              ? winnerAuthenticatorId
              : loserAuthenticatorId;

    const loserConsent = useRemoteLoserConsent({
        needsSwitch,
        remoteCredentialId,
        client,
    });
    // Winner passkey is local when desktop is the winner (needsSwitch=false);
    // otherwise the winner cred lives on the paired mobile and the
    // addPassKey userOp routes through the merge pairing. `undefined`
    // during preview loading defaults to "local" — the mutation's args
    // check kicks in before that gets exercised since MergeFlow guards the
    // sign step behind `preview.data` being resolved.
    const sendAddPassKey = useSendAddPassKeyTx({
        transport: needsSwitch ? "paired" : "local",
    });
    // Mirror of `sendAddPassKey`: loser passkey is local when desktop is
    // the loser (needsSwitch=true); otherwise it lives on the paired
    // mobile and the migration UserOp is signed over the existing merge
    // pairing.
    const migrateLoserAssets = useMigrateLoserAssets({
        transport: needsSwitch ? "local" : "paired",
    });

    const onRetry = useCallback(() => {
        if (
            client.state.status === "error" ||
            client.state.status === "retry-error"
        ) {
            client.reset();
        }
        // The actual re-initiate is driven by the active step's mutation
        // (it tracks the last set of options it passed). Reset is enough
        // to let the user retry from a clean state.
    }, [client]);

    // Tear down the pairing session when MergeFlow exits via any path that
    // isn't the terminal success step. `softReset()` clears the in-flight
    // handshake + rejects any pending signature-request promise; clearing
    // the detached store drops the paired credential snapshot. Live
    // `sessionStore` was never touched, so there's no rollback to perform.
    const cancel = useCallback(() => {
        client.cancelAllSignatureRequests("merge-aborted");
        client.softReset();
        detachedPairingSessionStore.getState().clearDetachedSession();
    }, [client]);

    return {
        mode: "remote",
        pairingId,
        remote: {
            pairingState,
            onRetry,
        },
        cancel,
        loserConsent,
        sendAddPassKey,
        migrateLoserAssets,
    };
}

/**
 * Loser consent for the cross-device flow. Branches on `needsSwitch` at
 * mutate-time so the hook tree is stable across preview load:
 *  - desktop=loser: sign locally with the loser passkey (matches today's
 *    `useLoserConsent`).
 *  - desktop=winner: forward the deterministic challenge to the paired
 *    mobile as a `raw-assertion` signature-request; the response is the
 *    base64 WebAuthn assertion JSON ready to send to `/merge/settle`.
 */
function useRemoteLoserConsent({
    needsSwitch,
    remoteCredentialId,
    client,
}: {
    needsSwitch: boolean | undefined;
    remoteCredentialId: string | undefined;
    client: ReturnType<typeof getOriginPairingClient>;
}): LoserConsentMutation {
    return useMutation<LoserConsentResult, Error, LoserConsentArgs>({
        mutationKey: authKey.merge.consent,
        gcTime: 0,
        mutationFn: async ({ winner, loserAuthenticatorId }) => {
            if (needsSwitch === undefined) {
                throw new Error("MERGE_REMOTE_CONSENT_PREVIEW_NOT_READY");
            }

            if (needsSwitch) {
                // Desktop is the loser — passkey is local. Defer to the
                // shared util so the local same-device contract is
                // single-sourced.
                return signMergeConsentLocally({
                    winner,
                    loserAuthenticatorId,
                });
            }

            // Desktop is the winner — loser passkey is on the paired
            // mobile. Initiate the pairing if it isn't live yet, then ask
            // the peer for the consent assertion over the WS as
            // `raw-assertion`.
            if (!remoteCredentialId) {
                throw new Error("MERGE_REMOTE_CONSENT_HINT_MISSING");
            }
            const challengeString = buildMergeConsentChallenge({
                winner,
                loserAuthenticatorId,
                hourSlot: formatMergeConsentHourSlot(new Date()),
            });
            const challenge = stringToHex(challengeString);
            await ensurePairingReady({
                client,
                authenticatorHint: remoteCredentialId,
            });
            const loserConsentSignature = await client.sendSignatureRequest(
                challenge,
                { signatureKind: "raw-assertion" }
            );
            return { loserConsentSignature };
        },
    });
}

/**
 * Initiate the pairing (if not already authenticated for the supplied
 * hint) and resolve once the WS handshake completes. Idempotent at the
 * Promise level — multiple callers waiting on the same handshake all
 * resolve from the single backend `authenticated` event.
 */
function ensurePairingReady({
    client,
    authenticatorHint,
}: {
    client: ReturnType<typeof getOriginPairingClient>;
    authenticatorHint: string;
}): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        let settled = false;
        const finish = (cb: () => void) => {
            if (settled) return;
            settled = true;
            unsubscribe();
            cb();
        };

        // Watch for fatal pairing states so the mutation rejects rather
        // than hanging on a dead WS (e.g. mobile cancelled the join, retry
        // budget exhausted, server-side fatal close).
        const unsubscribe = client.store.subscribe((state) => {
            if (state.status === "error" || state.status === "retry-error") {
                finish(() =>
                    reject(
                        new Error(
                            `MERGE_REMOTE_PAIRING_${state.status.toUpperCase()}`
                        )
                    )
                );
            }
        });

        void client.initiatePairing({
            authenticatorHint,
            detached: true,
            onSuccess: () => finish(() => resolve()),
        });
    });
}
