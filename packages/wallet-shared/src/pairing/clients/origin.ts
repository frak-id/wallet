import { jotaiStore } from "@frak-labs/ui/atoms/store";
import { nanoid } from "nanoid";
import type { Hex } from "viem";
import { trackAuthCompleted } from "@/common/analytics";
import { sdkSessionAtom, sessionAtom } from "@/common/atoms/session";
import { getSafeSession } from "@/common/utils/safeSession";
import type {
    OriginPairingState,
    WsOriginMessage,
    WsOriginRequest,
} from "../types";
import { BasePairingClient } from "./base";

export type OnPairingSuccessCallback = () => void | Promise<void>;

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
    WsOriginMessage,
    OriginPairingState
> {
    private pendingPings = 0;

    private onPairingSuccess: OnPairingSuccessCallback | null = null;

    /**
     * Get the initial state for the client
     */
    protected getInitialState(): OriginPairingState {
        return {
            partnerDevice: null,
            status: "idle",
            signatureRequests: new Map(),
            closeInfo: undefined,
        };
    }

    /**
     * Initiate a new pairing
     */
    async initiatePairing(onSuccess?: OnPairingSuccessCallback) {
        this.onPairingSuccess = onSuccess ?? null;

        this.forceConnect(() =>
            this.connect({
                action: "initiate",
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

        if (session.type !== "distant-webauthn") {
            console.warn(
                "Not a distant-webauthn session, skipping reconnection"
            );
            return;
        }

        // Launch the WS connection
        this.connect({
            wallet: session.token,
        });

        // Start the ping interval
        this.startPingInterval();
    }

    /**
     * Send a signature request to the pairing server
     */
    async sendSignatureRequest(request: Hex, context?: object): Promise<Hex> {
        return new Promise((resolve, reject) => {
            const id = nanoid(16);
            const signatureRequests = new Map(this.state.signatureRequests);
            signatureRequests.set(id, { resolve, reject });
            this.setState({ signatureRequests });

            this.send({
                type: "signature-request",
                payload: {
                    id,
                    request,
                    context,
                },
            });
        });
    }

    /**
     * Handle a message from the pairing server
     */
    protected override handleMessage(message: WsOriginMessage) {
        // Pairing initiated message (update pairing)
        if (message.type === "pairing-initiated") {
            this.setState({
                status: "connecting",
                pairing: {
                    id: message.payload.pairingId,
                    code: message.payload.pairingCode,
                },
            });
        }

        // Signature response
        if (message.type === "signature-response") {
            const request = this.state.signatureRequests.get(
                message.payload.id
            );
            if (request) {
                request.resolve(message.payload.signature);
                const signatureRequests = new Map(this.state.signatureRequests);
                signatureRequests.delete(message.payload.id);
                this.setState({ signatureRequests });
            }
            return;
        }

        // Signature reject
        if (message.type === "signature-reject") {
            const request = this.state.signatureRequests.get(
                message.payload.id
            );
            if (request) {
                request.reject(message.payload.reason);
                const signatureRequests = new Map(this.state.signatureRequests);
                signatureRequests.delete(message.payload.id);
                this.setState({ signatureRequests });
            }
            return;
        }

        // Partner connected message (update partner device)
        if (message.type === "partner-connected") {
            this.setState({
                status: "paired",
                partnerDevice: message.payload.deviceName,
            });
            return;
        }

        // Pong message (enforce paired state)
        if (message.type === "pong") {
            this.pendingPings = 0;
            this.setState({ status: "paired" });
            return;
        }

        // Authenticated message (update session status)
        if (message.type === "authenticated") {
            this.setState({ status: "paired" });

            // Store the session
            jotaiStore.set(sessionAtom, {
                token: message.payload.token,
                ...message.payload.wallet,
            });
            jotaiStore.set(sdkSessionAtom, message.payload.sdkJwt);

            // Track the event
            trackAuthCompleted("pairing", message.payload.wallet);

            // And trigger a reconnection
            this.forceConnect(() => this.reconnect());

            // Trigger the success callback if any
            this.onPairingSuccess?.();
        }
    }

    /**
     * Start the ping interval
     */
    protected startPingInterval() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
        }

        this.pingInterval = setInterval(() => {
            // If we got more than 5 pending pings, close the connection
            if (this.pendingPings > 5) {
                this.connection?.close();
                this.connection = null;
                // And reset the ping counter
                this.pendingPings = 0;
                return;
            }

            // Send a ping
            this.send({ type: "ping" });
            this.pendingPings++;
        }, 5_000);
    }
}
