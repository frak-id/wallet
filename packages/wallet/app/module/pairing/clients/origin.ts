import { jotaiStore } from "@frak-labs/shared/module/atoms/store";
import type { Hex } from "viem";
import { sdkSessionAtom, sessionAtom } from "../../common/atoms/session";
import { getSafeSession } from "../../listener/utils/localStorage";
import type { WsOriginMessage, WsOriginRequest } from "../types";
import {
    BasePairingClient,
    type BasePairingState,
    type PairingWsEventListener,
} from "./base";

type OriginState = "idle" | "pairing" | "reconnecting" | "paired" | "error";

type OriginPairingState = BasePairingState & {
    status: OriginState;
    signatureRequests: Map<
        string,
        {
            resolve: (value: Hex) => void;
            reject: (reason: unknown) => void;
        }
    >;
};

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
    /**
     * Get the initial state for the client
     */
    protected getInitialState(): OriginPairingState {
        return {
            partnerDevice: null,
            status: "idle",
            signatureRequests: new Map(),
        };
    }

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

            // Set the state to pairing
            this.setState({ status: "pairing" });

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

        // Launch the WS connection
        this.connect();

        // Set the state to reconnecting
        this.setState({ status: "reconnecting" });

        // Force trigger a ping event
        this.send({ type: "ping" });
    }

    /**
     * Send a webauthn request to the pairing server
     */
    async sendWebAuthnRequest(request: Hex, context?: object): Promise<string> {
        return new Promise((resolve, reject) => {
            const id = crypto.randomUUID();
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
