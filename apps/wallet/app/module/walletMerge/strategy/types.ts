import type { Session } from "@frak-labs/wallet-shared";
import type { OriginPairingState } from "@frak-labs/wallet-shared/pairing/types";
import type { UseMutationResult } from "@tanstack/react-query";
import type { Address } from "viem";
import type { LoserConsentResult } from "../hook/useLoserConsent";

export type LoserConsentArgs = {
    winner: Address;
    loserAuthenticatorId: string;
};

export type LoserConsentMutation = UseMutationResult<
    LoserConsentResult,
    Error,
    LoserConsentArgs
>;

export type SwitchToWinnerArgs = {
    wallet: Address;
    authenticatorId: string;
    transports?: AuthenticatorTransport[];
};

export type SwitchToWinnerMutation = UseMutationResult<
    Session | undefined,
    Error,
    SwitchToWinnerArgs
>;

/**
 * Strategy implemented by `useLocalMergeStrategy` and `useRemoteMergeStrategy`.
 *
 * `MergeFlow` is the same shell either way — same step components, same
 * ordering, same animations. The strategy plugs in the mutations that
 * differ between the same-device and cross-device flows:
 *  - `useLoserConsent` produces the merge-consent assertion locally on
 *    desktop OR ferries the request through pairing as a raw-assertion
 *    signature-request.
 *  - `useSwitchToWinner` performs a local `useLogin` swap OR drives the
 *    pairing handshake whose `authenticated` message swaps the live
 *    session to a distant-webauthn one.
 *
 * The remote strategy additionally exposes its underlying pairing state
 * so the SwitchStep / ConsentStep remote variants can render the QR and
 * status banner without re-deriving the client themselves.
 */
export type MergeStrategy = {
    mode: "local" | "remote";
    /**
     * Pairing id once the cross-device session is live. Threaded into
     * `useMergeSettle` so the backend emits `merge-completed`. `undefined`
     * for the local strategy and during the remote strategy's pre-auth
     * window.
     */
    pairingId: string | undefined;
    /**
     * Surface used by the remote-variant step components to render the QR
     * + status banner. `undefined` for the local strategy.
     */
    remote?: {
        pairingState: OriginPairingState;
        onRetry: () => void;
    };
    useLoserConsent: () => LoserConsentMutation;
    useSwitchToWinner: () => SwitchToWinnerMutation;
};
