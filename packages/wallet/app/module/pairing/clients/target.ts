import type { Hex } from "viem";
import { getSafeSession } from "../../listener/utils/localStorage";
import type {
    TargetPairingState,
    WsTargetMessage,
    WsTargetRequest,
} from "../types";
import { BasePairingClient } from "./base";

/**
 * The pairing client for a target device, the one responding to the pairing requests
 */
export class TargetPairingClient extends BasePairingClient<
    WsTargetRequest,
    WsTargetMessage,
    TargetPairingState
> {
    /**
     * Get the initial state for the client
     */
    protected getInitialState(): TargetPairingState {
        return {
            status: "idle",
            partnerDevice: null,
            pendingSignatures: new Map(),
            pairingIdState: new Map(),
            closeInfo: undefined,
        };
    }

    /**
     * Join a new pairing request
     */
    joinPairing(id: string, pairingCode: string) {
        const session = getSafeSession();
        if (!session) {
            console.warn("No session found, skipping reconnection");
            return;
        }

        this.forceConnect(() =>
            this.connect({
                action: "join",
                id,
                pairingCode,
                wallet: session.token,
            })
        );
    }

    /**
     * Reconnect to all the pairing associated with the current wallet
     */
    reconnect() {
        const session = getSafeSession();
        if (!session) {
            console.warn("No session found, skipping reconnection");
            return;
        }

        if (session.type !== undefined && session.type !== "webauthn") {
            console.warn(
                "Session is not a webauthn session, skipping reconnection"
            );
            return;
        }

        this.connect({
            wallet: session.token,
        });
    }

    /**
     * Handle a message from the pairing server
     */
    protected override handleMessage(message: WsTargetMessage) {
        // Handle a ping request
        if (message.type === "ping") {
            this.send({
                type: "pong",
                payload: {
                    pairingId: message.payload.pairingId,
                },
            });
            this.updateState((state) => {
                state.pairingIdState.set(message.payload.pairingId, {
                    name:
                        state.pairingIdState.get(message.payload.pairingId)
                            ?.name ?? "",
                    lastLive: Date.now(),
                });
                return {
                    ...state,
                    status: "paired",
                };
            });
            return;
        }

        // Handle partner connected
        if (message.type === "partner-connected") {
            this.updateState((state) => {
                state.pairingIdState.set(message.payload.pairingId, {
                    name: message.payload.deviceName,
                    lastLive: Date.now(),
                });
                return {
                    ...state,
                    status: "paired",
                    partnerDevice: message.payload.deviceName,
                };
            });
            return;
        }

        // Handle webauthn request
        if (message.type === "signature-request") {
            const request = message.payload;
            this.updateState((state) => {
                state.pendingSignatures.set(request.id, {
                    id: request.id,
                    pairingId: request.pairingId,
                    request: request.request,
                    context: request.context,
                    from: request.partnerDeviceName,
                });
                state.pairingIdState.set(request.pairingId, {
                    name: request.partnerDeviceName,
                    lastLive: Date.now(),
                });
                return {
                    ...state,
                    status: "paired",
                };
            });
            return;
        }
    }

    /**
     * Send back a signature response or rejection to the pairing server
     */
    sendSignatureResponse(
        requestId: string,
        response: { signature: Hex } | { reason: string }
    ) {
        const request = this.state.pendingSignatures.get(requestId);
        if (!request) {
            console.warn("No request found for id", requestId);
            return;
        }

        if ("signature" in response) {
            // Handle signature response
            this.send({
                type: "signature-response",
                payload: {
                    pairingId: request.pairingId,
                    id: requestId,
                    signature: response.signature,
                },
            });
        } else {
            // Handle signature rejection
            this.send({
                type: "signature-reject",
                payload: {
                    pairingId: request.pairingId,
                    id: requestId,
                    reason: response.reason,
                },
            });
        }

        this.updateState((state) => {
            state.pendingSignatures.delete(requestId);
            return state;
        });
    }
}
