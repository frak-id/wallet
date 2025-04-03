import { getSafeSession } from "../../listener/utils/localStorage";
import type { WsTargetMessage, WsTargetRequest } from "../types";
import { BasePairingClient } from "./base";

/**
 * - should store a list of pending webauthn requests
 * - should be able to fetch all the pending requests ids
 * - should be auto created if the user got a webauthn type session
 * - should be destroyed + recreated on joining request
 */
export class TargetPairingClient extends BasePairingClient<
    WsTargetRequest,
    WsTargetMessage
> {
    /**
     * Join a new pairing request
     */
    async joinPairing(pairingCode: string): Promise<void> {
        await this.connect({
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

        await this.connect();
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
        }

        // Handle webauthn request
        if (message.type === "signature-request") {
            this.handleSignatureRequest(message.payload);
        }
    }

    /**
     * Handle a webauthn request
     *  - todo: we should have a queue of pending webauthn requests
     */
    private async handleSignatureRequest(
        request: Extract<
            WsTargetMessage,
            { type: "signature-request" }
        >["payload"]
    ) {
        try {
            // This should be implemented by the consumer
            // todo
            console.log("handleSignatureRequest", request);
        } catch (error) {
            console.error("Failed to handle WebAuthn request:", error);
        }
    }

    /**
     * Post setup hook
     */
    protected override setupHook() {}
}
