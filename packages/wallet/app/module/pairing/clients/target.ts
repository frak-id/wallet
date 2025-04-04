import { getSafeSession } from "../../listener/utils/localStorage";
import type { WsTargetMessage, WsTargetRequest } from "../types";
import { BasePairingClient, type BasePairingState } from "./base";

type TargetPairingState = BasePairingState & {
    pendingRequests: Map<
        string,
        {
            id: string;
            request: string;
            context?: object;
        }
    >;
};

/**
 * - should store a list of pending webauthn requests
 * - should be able to fetch all the pending requests ids
 * - should be auto created if the user got a webauthn type session
 * - should be destroyed + recreated on joining request
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
            pendingRequests: new Map(),
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

        // todo: need to ensure it's a webauthn type session

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
            this.setState({ status: "paired" });
            return;
        }

        // Handle partner connected
        if (message.type === "partner-connected") {
            this.setState({
                status: "paired",
                partnerDevice: message.payload.deviceName,
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
            const pendingRequests = new Map(this.state.pendingRequests);
            pendingRequests.set(request.id, {
                id: request.id,
                request: request.request,
                context: request.context,
            });
            this.setState({ pendingRequests });

            // This should be implemented by the consumer
            // todo
            console.log("handleSignatureRequest", request);
        } catch (error) {
            console.error("Failed to handle WebAuthn request:", error);
        }
    }
}
