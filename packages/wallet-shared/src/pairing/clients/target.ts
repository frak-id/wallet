import type { Hex } from "viem";
import { getSafeSession } from "../../common/utils/safeSession";
import type {
    PairingSignatureFailure,
    SignatureRejectReason,
    TargetPairingState,
    WsTargetMessage,
    WsTargetRequest,
} from "../types";
import { BasePairingClient } from "./base";

/**
 * Pairing client for a target device — the wallet performing the
 * biometric signature on the user's behalf.
 *
 * The client maintains a Map of pending signature requests (`pendingSignatures`)
 * and exposes UI hooks via the Zustand store. Requests survive transient
 * WS closes — only fatal closes (auth failure, retry budget exhausted)
 * clear them, and even then the server will replay anything still alive
 * upon successful reconnection.
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

        if (session.type !== undefined && session.type !== "webauthn") {
            console.warn(
                "Session is not a webauthn session, skipping reconnection"
            );
            return;
        }

        // If the connection is still alive, nothing to do
        if (this.isAlive()) return;

        this.connect({
            wallet: session.token,
        });
    }

    /**
     * Override of base hook — drop every pending signature on a fatal close.
     * No promises to reject on this side: the wallet UI just clears the prompts.
     */
    protected override rejectAllRequests(
        _reason: PairingSignatureFailure
    ): void {
        if (this.state.pendingSignatures.size === 0) return;
        this.setState({ pendingSignatures: new Map() });
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
                const pairingIdState = new Map(state.pairingIdState);
                pairingIdState.set(message.payload.pairingId, {
                    name:
                        state.pairingIdState.get(message.payload.pairingId)
                            ?.name ?? "",
                    lastLive: Date.now(),
                });
                return {
                    ...state,
                    pairingIdState,
                    status: "paired",
                };
            });
            return;
        }

        // Handle partner connected
        if (message.type === "partner-connected") {
            this.updateState((state) => {
                const pairingIdState = new Map(state.pairingIdState);
                pairingIdState.set(message.payload.pairingId, {
                    name: message.payload.deviceName,
                    lastLive: Date.now(),
                });
                return {
                    ...state,
                    pairingIdState,
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
                const pendingSignatures = new Map(state.pendingSignatures);
                pendingSignatures.set(request.id, {
                    id: request.id,
                    pairingId: request.pairingId,
                    request: request.request,
                    context: request.context,
                    from: request.partnerDeviceName,
                });
                const pairingIdState = new Map(state.pairingIdState);
                pairingIdState.set(request.pairingId, {
                    name: request.partnerDeviceName,
                    lastLive: Date.now(),
                });
                return {
                    ...state,
                    pendingSignatures,
                    pairingIdState,
                    status: "paired",
                };
            });
            return;
        }

        // Handle signature-reject coming from server (origin cancelled or
        // server-side TTL expired). The wallet UI just removes the request from
        // `pendingSignatures`.
        if (message.type === "signature-reject") {
            const id = message.payload.id;
            if (!this.state.pendingSignatures.has(id)) return;
            this.updateState((state) => {
                const pendingSignatures = new Map(state.pendingSignatures);
                pendingSignatures.delete(id);
                return { ...state, pendingSignatures };
            });
            return;
        }
    }

    /**
     * Send back a signature response or rejection to the pairing server
     */
    sendSignatureResponse(
        requestId: string,
        response: { signature: Hex } | { reason: SignatureRejectReason }
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
            const pendingSignatures = new Map(state.pendingSignatures);
            pendingSignatures.delete(requestId);
            return { ...state, pendingSignatures };
        });
    }
}
