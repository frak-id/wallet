import type { WebAuthnRequest, WsMessage } from "../types";
import { BasePairingClient } from "./base";

/**
 * - should store a list of pending webauthn requests
 * - should be able to fetch all the pending requests ids
 * - should be auto created if the user got a webauthn type session
 * - should be destroyed + recreated on joining request
 */
export class TargetPairingClient extends BasePairingClient {
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
     * Reconnect to the pairing
     */
    async reconnect(): Promise<void> {
        await this.connect();
    }

    /**
     * Handle a message from the pairing server
     */
    protected override handleMessage(message: WsMessage) {
        // Handle a ping request
        if (message.type === "ping") {
            // todo: how could we know the topic on which this msg was sent?
            // this.send({
            //     type: "pong",
            //     payload: {
            //         pairingId: this.pairingId!,
            //     },
            // });
        }

        // Handle webauthn request
        if (message.type === "webauthn-request") {
            this.handleWebAuthnRequest(message.payload);
        }
    }

    /**
     * Handle a webauthn request
     *  - todo: we should have a queue of pending webauthn requests
     */
    private async handleWebAuthnRequest(request: WebAuthnRequest) {
        try {
            // This should be implemented by the consumer
            if (this.onWebAuthnRequest) {
                const response = await this.onWebAuthnRequest(request);

                // todo: how could we know the topic on which this msg was sent?
                // this.send({
                //     type: "webauthn-response",
                //     payload: {
                //         pairingId: this.pairingId!,
                //         id: request.id,
                //         response,
                //     },
                // });
            }
        } catch (error) {
            console.error("Failed to handle WebAuthn request:", error);
        }
    }

    /**
     * Post setup hook
     */
    protected override setupHook() {}

    /**
     * WebAuthn request handler
     */
    onWebAuthnRequest?: (request: WebAuthnRequest) => Promise<string>;
}
