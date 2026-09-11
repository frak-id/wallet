import type { OriginPairingState } from "@frak-labs/wallet-shared/pairing/types";
import type { UseMutationResult } from "@tanstack/react-query";
import type { Address } from "viem";
import type { LoserConsentResult } from "../hook/useLoserConsent";
import type {
    MigrateLoserAssetsArgs,
    MigrateLoserAssetsResult,
} from "../hook/useMigrateLoserAssets";
import type {
    SendAddPassKeyArgs,
    SendAddPassKeyResult,
} from "../hook/useSendAddPassKeyTx";

/**
 * Narrow projection of {@link OriginPairingState}: keeping it tight lets the
 * strategy subscribe with a shallow selector and avoid re-rendering on every
 * WS-tick mutation of `signatureRequests`/`partnerDevice`.
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

export type SendAddPassKeyMutation = UseMutationResult<
    SendAddPassKeyResult,
    Error,
    SendAddPassKeyArgs
>;

export type MigrateLoserAssetsMutation = UseMutationResult<
    MigrateLoserAssetsResult,
    Error,
    MigrateLoserAssetsArgs
>;

/**
 * Strategy implemented by `useLocalMergeStrategy` and `useRemoteMergeStrategy`.
 *
 * Both must call their React Query hooks **internally** and surface the
 * resulting mutation objects as plain fields: `MergeFlow` must NOT call them as
 * hook factories, or its `useMutation` count would change when `mode` switches
 * mid-render, violating the rules of hooks.
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
     * the user has already backed out. No-op for the local strategy.
     */
    cancel?: () => void;
    loserConsent: LoserConsentMutation;
    /**
     * Submits the on-chain `addPassKey` userOp from the winner smart wallet.
     * Idempotent — a run with an already-bound passkey resolves to
     * `{ txHash: undefined }`.
     */
    sendAddPassKey: SendAddPassKeyMutation;
    /**
     * Drains the loser smart wallet (claims pending rewarder balances, then
     * transfers stablecoins to the winner) in one batched UserOp. A run with no
     * funds resolves to `{ txHash: undefined }` so the step can auto-advance.
     */
    migrateLoserAssets: MigrateLoserAssetsMutation;
};
