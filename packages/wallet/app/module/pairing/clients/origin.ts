import type { Hex } from "viem";
import { getSafeSession } from "../../listener/utils/localStorage";
import type { WsOriginMessage, WsOriginRequest } from "../types";
import { BasePairingClient, type PairingWsEventListener } from "./base";

/**
 * A pairing client for an origin device (likely desktop, the one responsible to create a pairing)
 *
 * - mechanism to empty the signature map?
 * - should be auto created if we have a current session of type `distant-webauthn`
 * - we should also abstract the signer of the wagmi provider, to change the signature payload
 * - should expose some stuff that could be useful on the UI (like pairing step, if we got an answer to our latest `ping`, amount of pending signature etc)
 */
export class OriginPairingClient extends BasePairingClient<
    WsOriginRequest,
    WsOriginMessage
> {
    /**
     * Map of signature requests id to resolving promise
     */
    private signatureRequests = new Map<
        string,
        {
            resolve: (value: Hex) => void;
            reject: (reason: unknown) => void;
        }
    >();

    /**
     * Initiate a new pairing
     */
    async initiatePairing({
        ssoId,
    }: {
        ssoId?: Hex;
    } = {}): Promise<{
        pairingId: string;
        pairingCode: string;
    }> {
        return new Promise((resolve, reject) => {
            // todo: should remove the listener when the promise is resolved
            const handlePairingInitiated: PairingWsEventListener = ({
                data,
            }) => {
                if (!this.isWsMessageData(data)) {
                    return;
                }

                if (data.type === "pairing-initiated") {
                    resolve(data.payload);
                }
            };

            this.connect({
                action: "initiate",
                ssoId,
            });

            // Listen for the pairing initiated event
            if (this.connection) {
                this.connection.on("message", handlePairingInitiated);
                this.connection.on("error", reject);
            }
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

        if (session.type !== "distant-webauthn") {
            console.warn(
                "Not a distant-webauthn session, skipping reconnection"
            );
            return;
        }

        await this.connect();
    }

    /**
     * Send a webauthn request to the pairing server
     */
    async sendWebAuthnRequest(request: Hex, context?: object): Promise<string> {
        return new Promise((resolve, reject) => {
            const id = crypto.randomUUID();
            this.signatureRequests.set(id, { resolve, reject });

            this.send({
                type: "signature-request",
                payload: {
                    id,
                    request,
                    context,
                },
            });

            // Add timeout
            // todo: do we rly want that?
            // setTimeout(() => {
            //     this.webAuthnRequests.delete(id);
            //     reject(new Error("WebAuthn request timeout"));
            // }, 120_000);
        });
    }

    /**
     * Handle a message from the pairing server
     */
    protected override handleMessage(message: WsOriginMessage) {
        if (message.type === "signature-response") {
            const request = this.signatureRequests.get(message.payload.id);
            if (request) {
                request.resolve(message.payload.signature);
                this.signatureRequests.delete(message.payload.id);
            }
        }
    }

    /**
     * Setup the hook for the pairing websocket
     */
    protected override setupHook() {
        this.startPingInterval();
    }

    /**
     * Start the ping interval
     */
    protected startPingInterval() {
        this.pingInterval = setInterval(() => {
            this.send({ type: "ping" });
        }, 15000);
    }
}
