import { nanoid } from "nanoid";
import type { Hex } from "viem";
import { identifyAuthenticatedUser, trackEvent } from "../../common/analytics";
import { getSafeSession } from "../../common/utils/safeSession";
import { sessionStore } from "../../stores/sessionStore";
import type {
    OriginIdentityNode,
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

    async initiatePairing(options?: {
        onSuccess?: OnPairingSuccessCallback;
        originNode?: OriginIdentityNode;
    }) {
        this.onPairingSuccess = options?.onSuccess ?? null;

        this.forceConnect(() =>
            this.connect({
                action: "initiate",
                originNode: options?.originNode,
            })
        );
    }

    /**
     * Reconnect to all the pairing associated with the current wallet.
     * Uses isAlive() to detect and clean up zombie connections left
     * after the app was backgrounded on mobile.
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

        // If the connection is still alive, nothing to do
        if (this.isAlive()) return;

        // Reset stale ping state from previous connection
        this.pendingPings = 0;

        // Launch the WS connection
        this.connect({
            wallet: session.token,
        });

        // Start the ping interval
        this.startPingInterval();
    }

    private static readonly SIGNATURE_TIMEOUT_MS = 10 * 60 * 1_000; // 10 minutes

    async sendSignatureRequest(request: Hex, context?: object): Promise<Hex> {
        // Fail fast if we're not actually connected to the partner device.
        // Without this guard, the request would silently sit in the queue and
        // resolve only after a 10-minute timeout (because `this.send` becomes
        // a no-op once the websocket is closed).
        if (
            this.state.status !== "paired" &&
            this.state.status !== "connecting"
        ) {
            throw new Error(
                `Pairing not connected (status: ${this.state.status}). ` +
                    "Reconnect the partner device before requesting a signature."
            );
        }

        return new Promise((resolve, reject) => {
            const id = nanoid(16);

            const timer = setTimeout(() => {
                this.removeSignatureRequest(id);
                reject(
                    new Error("Signature request timed out after 10 minutes")
                );
            }, OriginPairingClient.SIGNATURE_TIMEOUT_MS);

            const signatureRequests = new Map(this.state.signatureRequests);
            signatureRequests.set(id, {
                resolve: (value: Hex) => {
                    clearTimeout(timer);
                    resolve(value);
                },
                reject: (reason: unknown) => {
                    clearTimeout(timer);
                    reject(reason);
                },
            });
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

    private removeSignatureRequest(id: string) {
        const signatureRequests = new Map(this.state.signatureRequests);
        signatureRequests.delete(id);
        this.setState({ signatureRequests });
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

        if (message.type === "signature-response") {
            const request = this.state.signatureRequests.get(
                message.payload.id
            );
            if (request) {
                request.resolve(message.payload.signature);
                this.removeSignatureRequest(message.payload.id);
            }
            return;
        }

        if (message.type === "signature-reject") {
            const request = this.state.signatureRequests.get(
                message.payload.id
            );
            if (request) {
                request.reject(message.payload.reason);
                this.removeSignatureRequest(message.payload.id);
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
            sessionStore.getState().setSession({
                token: message.payload.token,
                ...message.payload.wallet,
            });
            sessionStore.getState().setSdkSession(message.payload.sdkJwt);

            // Track the event
            identifyAuthenticatedUser(message.payload.wallet);
            trackEvent("pairing_completed");

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
