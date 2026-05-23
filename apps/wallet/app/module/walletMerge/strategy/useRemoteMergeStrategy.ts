import {
    buildMergeConsentChallenge,
    formatMergeConsentHourSlot,
    WebAuthN,
} from "@frak-labs/app-essentials";
import {
    authKey,
    getOriginPairingClient,
    getTauriGetFn,
    type Session,
} from "@frak-labs/wallet-shared";
import { useMutation } from "@tanstack/react-query";
import { WebAuthnP256 } from "ox";
import { useCallback, useMemo } from "react";
import { stringToHex } from "viem";
import { useStore } from "zustand";
import type { LoserConsentResult } from "../hook/useLoserConsent";
import type {
    LoserConsentArgs,
    LoserConsentMutation,
    MergeStrategy,
    SwitchToWinnerArgs,
    SwitchToWinnerMutation,
} from "./types";

type UseRemoteMergeStrategyArgs = {
    /**
     * `true` when desktop is the loser (mobile holds the winner passkey) —
     * pairing must swap the live session to distant-webauthn so wagmi
     * tunnels the on-chain step through the paired peer.
     * `false` when desktop is the winner (mobile holds the loser passkey) —
     * pairing only carries the consent assertion; desktop keeps its own
     * local session for signing the userOp.
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
 * Mirrors the two branches of the same-device flow:
 *  - `needsSwitch=true` (desktop=loser, mobile=winner): pairing is
 *    initiated with `applySession=true` so `OriginPairingClient` swaps the
 *    live session for distant-webauthn=B. Wagmi then routes the on-chain
 *    `addPassKey` userOp through the pairing automatically via
 *    `frakPairedWalletSmartAccount`.
 *  - `needsSwitch=false` (desktop=winner, mobile=loser): pairing is
 *    initiated with `applySession=false` so the WS connection is upgraded
 *    but `sessionStore` stays on the local winner session. The loser
 *    consent assertion is ferried back as a `signatureKind: "raw-assertion"`
 *    signature-request.
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
    const pairingState = useStore(client.store);
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
    const switchToWinner = useRemoteSwitchToWinner({
        remoteCredentialId,
        client,
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
    // isn't the terminal success step. Without this, a late `authenticated`
    // event arriving after the user has aborted would still apply a distant
    // session to the live slot (handleAuthenticated is unconditional in the
    // OriginPairingClient). `softReset()` clears the in-flight handshake +
    // rejects any pending signature-request promise WITHOUT touching
    // `sessionStore` — `reset()` would call `clearSession()` and log the
    // user out (`session`, `previousSession`, and `sdkSession` are all
    // wiped), which is fine after a 4401 but catastrophic on a user-driven
    // merge cancel.
    const cancel = useCallback(() => {
        client.cancelAllSignatureRequests("merge-aborted");
        client.softReset();
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
        switchToWinner,
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

            const challengeString = buildMergeConsentChallenge({
                winner,
                loserAuthenticatorId,
                hourSlot: formatMergeConsentHourSlot(new Date()),
            });
            const challenge = stringToHex(challengeString);

            if (needsSwitch) {
                // Desktop is the loser — passkey is local. Reproduces
                // today's `useLoserConsent` body verbatim; kept inline so
                // the strategy doesn't depend on the local hook's
                // internals.
                const tauriGetFn = getTauriGetFn();
                const { metadata, signature, raw } = await WebAuthnP256.sign({
                    credentialId: loserAuthenticatorId,
                    rpId: WebAuthN.rpId,
                    userVerification: "required",
                    challenge,
                    ...(tauriGetFn && { getFn: tauriGetFn }),
                });
                if (raw.id !== loserAuthenticatorId) {
                    throw new Error("MERGE_CONSENT_WRONG_CREDENTIAL");
                }
                const assertion = {
                    id: raw.id,
                    response: { metadata, signature },
                };
                return {
                    loserConsentSignature: btoa(JSON.stringify(assertion)),
                };
            }

            // Desktop is the winner — loser passkey is on the paired
            // mobile. Initiate the pairing if it isn't live yet, then ask
            // the peer for the consent assertion over the WS as
            // `raw-assertion`. `applySession: false` keeps the local
            // session intact for the subsequent local userOp signing.
            if (!remoteCredentialId) {
                throw new Error("MERGE_REMOTE_CONSENT_HINT_MISSING");
            }
            await ensurePairingReady({
                client,
                applySession: false,
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
 * Cross-device equivalent of `useSwitchAuthenticator`. Drives the pairing
 * handshake with `applySession=true` so `OriginPairingClient.handleMessage`
 * parks the existing session and swaps the live slot for the freshly
 * minted distant-webauthn session. Resolves once `authenticated` has
 * landed and the live slot has been updated.
 *
 * Only used in the `needsSwitch=true` branch (desktop is the loser);
 * MergeFlow skips this step otherwise.
 */
function useRemoteSwitchToWinner({
    remoteCredentialId,
    client,
}: {
    remoteCredentialId: string | undefined;
    client: ReturnType<typeof getOriginPairingClient>;
}): SwitchToWinnerMutation {
    return useMutation<Session | undefined, Error, SwitchToWinnerArgs>({
        mutationKey: authKey.merge.switchAuthenticator,
        gcTime: 0,
        mutationFn: async () => {
            if (!remoteCredentialId) {
                throw new Error("MERGE_REMOTE_SWITCH_HINT_MISSING");
            }
            await ensurePairingReady({
                client,
                applySession: true,
                authenticatorHint: remoteCredentialId,
            });
            // The pairing client wrote the distant-webauthn session into
            // sessionStore during `authenticated` handling. Wagmi will pick
            // it up on next render — no explicit return value needed by
            // MergeFlow.
        },
    });
}

/**
 * Initiate the pairing (if not already authenticated for the supplied
 * params) and resolve once the WS handshake completes. Idempotent at the
 * Promise level — multiple callers waiting on the same handshake all
 * resolve from the single backend `authenticated` event.
 */
function ensurePairingReady({
    client,
    applySession,
    authenticatorHint,
}: {
    client: ReturnType<typeof getOriginPairingClient>;
    applySession: boolean;
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
            applySession,
            onSuccess: () => finish(() => resolve()),
        });
    });
}
