import type { Session } from "@frak-labs/wallet-shared";
import type { OriginPairingState } from "@frak-labs/wallet-shared/pairing/types";
import type { UseMutationResult } from "@tanstack/react-query";
import type { Address } from "viem";
import type { LoserConsentResult } from "../hook/useLoserConsent";
import type {
    MigrateLoserAssetsArgs,
    MigrateLoserAssetsResult,
} from "../hook/useMigrateLoserAssets";

/**
 * Narrow projection of {@link OriginPairingState} consumed by the remote
 * step UIs (`RemotePairingPanel`, `useRemoteMergeStrategy`). Keeping it
 * tight lets the strategy subscribe to the underlying store with a
 * shallow selector and avoid re-rendering on every WS-tick mutation of
 * `signatureRequests`/`partnerDevice`.
 */
export type RemotePairingSlice = Pick<OriginPairingState, "pairing" | "status">;

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

export type MigrateLoserAssetsMutation = UseMutationResult<
    MigrateLoserAssetsResult,
    Error,
    MigrateLoserAssetsArgs
>;

/**
 * Strategy implemented by `useLocalMergeStrategy` and `useRemoteMergeStrategy`.
 *
 * `MergeFlow` is the same shell either way — same step components, same
 * ordering, same animations. The strategy plugs in the mutations that
 * differ between the same-device and cross-device flows:
 *  - `loserConsent` produces the merge-consent assertion locally on
 *    desktop OR ferries the request through pairing as a raw-assertion
 *    signature-request.
 *  - `switchToWinner` performs a local `useLogin` swap OR drives the
 *    pairing handshake whose `authenticated` message swaps the live
 *    session to a distant-webauthn one.
 *
 * The remote strategy additionally exposes its underlying pairing state
 * so the SwitchStep / ConsentStep remote variants can render the QR and
 * status banner without re-deriving the client themselves.
 *
 * Both strategies must call their underlying React Query hooks
 * **internally** and surface the resulting mutation objects directly on
 * the strategy. `MergeFlow` reads them as plain fields — it must NOT call
 * them as hook factories, otherwise the rules of hooks would be violated
 * when `mode` switches mid-render (the count of useMutation calls inside
 * MergeFlow would change).
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
        pairingState: RemotePairingSlice;
        onRetry: () => void;
    };
    /**
     * Optional teardown hook. Called from `MergeFlow` on abort, unmount, or
     * any other non-success exit so a lingering pairing WS or in-flight
     * signature request doesn't apply a late `authenticated` event after
     * the user has already backed out. No-op for the local strategy —
     * `useSwitchAuthenticator`'s rollback is implicit in its catch path.
     */
    cancel?: () => void;
    loserConsent: LoserConsentMutation;
    switchToWinner: SwitchToWinnerMutation;
    /**
     * Mutation that drains the loser smart wallet of transferable assets
     * (claims pending rewarder balances, then transfers stablecoins to the
     * winner) in a single batched UserOp. Transport selection is baked in
     * per-strategy: same-device + cross-device-desktop-is-loser sign
     * locally; cross-device-desktop-is-winner routes the loser signing
     * through the same origin pairing that ferried the consent assertion.
     * A successful run with no funds resolves to `{ txHash: undefined }`
     * so the migrate step can auto-advance to settle.
     */
    migrateLoserAssets: MigrateLoserAssetsMutation;
};
