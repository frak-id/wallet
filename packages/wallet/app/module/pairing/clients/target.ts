import type { Hex } from "viem";
import { getSafeSession } from "../../listener/utils/localStorage";
import type {
    TargetPairingState,
    WsTargetMessage,
    WsTargetRequest,
} from "../types";
import { BasePairingClient } from "./base";

/**
 * - should store a list of pending webauthn requests
 * - should be able to fetch all the pending requests ids
 * - should be auto created if the user got a webauthn type session
 * - should be destroyed + recreated on joining request
 *
 * todo: Number of live connection with their timestamp
 *
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
        };
    }

    /**
     * Join a new pairing request
     */
    async joinPairing(pairingCode: string): Promise<void> {
        this.connect({
            action: "join",
            pairingCode,
        });
    }

    /**
     * Reconnect to all the pairing associated with the current wallet
     */
    async reconnect(): Promise<void> {
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

        this.connect();
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
            this.setState({ status: "paired" });
            this.handleSignatureRequest(message.payload);
            return;
        }
    }

    /**
     * Handle a webauthn request
     */
    private async handleSignatureRequest(
        request: Extract<
            WsTargetMessage,
            { type: "signature-request" }
        >["payload"]
    ) {
        try {
            // Store the request in pending requests
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
                return state;
            });

            // This should be implemented by the consumer
            // todo
            console.log("handleSignatureRequest", request);
        } catch (error) {
            console.error("Failed to handle WebAuthn request:", error);
        }
    }

    /**
     * Send back a signature response to the pairing server
     */
    async sendSignatureResponse(id: string, response: Hex) {
        const request = this.state.pendingSignatures.get(id);
        if (!request) {
            console.warn("No request found for id", id);
            return;
        }

        this.send({
            type: "signature-response",
            payload: {
                pairingId: request.pairingId,
                id,
                signature: response,
            },
        });

        this.updateState((state) => {
            state.pendingSignatures.delete(id);
            return state;
        });
    }
}
