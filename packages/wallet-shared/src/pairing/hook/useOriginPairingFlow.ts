import { useCallback, useEffect } from "react";
import { useStore } from "zustand";
import { trackEvent } from "../../common/analytics";
import type { OnPairingSuccessCallback } from "../clients/origin";
import { getOriginPairingClient } from "../clients/store";
import type { OriginIdentityNode, OriginPairingState } from "../types";

export type UseOriginPairingFlowOptions = {
    onSuccess?: OnPairingSuccessCallback;
    originNode?: OriginIdentityNode;
};

export type UseOriginPairingFlowReturn = {
    clientState: OriginPairingState;
    pairingInfo: OriginPairingState["pairing"];
    isError: boolean;
    handleRetry: () => void;
};

/**
 * Headless hook driving the origin-side pairing flow.
 *
 * - Initiates a pairing session on mount and emits the analytics event.
 * - Subscribes to the live client state.
 * - Exposes a single `handleRetry` callback that recovers from both
 *   transient (`retry-error`) and fatal (`error`) close states.
 *
 * Both `LaunchPairing` (compact reveal) and `PairingView` (full-page route)
 * compose this hook with their own visual shell.
 */
export function useOriginPairingFlow({
    onSuccess,
    originNode,
}: UseOriginPairingFlowOptions): UseOriginPairingFlowReturn {
    const client = getOriginPairingClient();
    const clientState = useStore(client.store);
    const isError =
        clientState.status === "error" || clientState.status === "retry-error";

    useEffect(() => {
        client.initiatePairing({ onSuccess, originNode });
        trackEvent("pairing_initiated");
    }, [client, onSuccess, originNode]);

    /**
     * Recover from a fatal/transient error surfaced by the origin client.
     * `retry-error` (reconnect budget exhausted) → just call reconnect().
     * `error` (fatal close) → reset() + a fresh initiatePairing() with the
     * options the parent passed to this component.
     */
    const handleRetry = useCallback(() => {
        if (client.state.status === "retry-error") {
            client.reconnect();
            return;
        }
        client.reset();
        client.initiatePairing({ onSuccess, originNode });
    }, [client, onSuccess, originNode]);

    return {
        clientState,
        pairingInfo: clientState.pairing,
        isError,
        handleRetry,
    };
}
