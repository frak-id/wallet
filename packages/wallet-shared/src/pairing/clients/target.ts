import type { Hex } from "viem";
import { getSafeSession } from "../../common/utils/safeSession";
import { detachedPairingSessionStore } from "../../stores/detachedPairingSessionStore";
import { sessionStore } from "../../stores/sessionStore";
import type { Session } from "../../types/Session";
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
     * Join a new pairing request.
     *
     * If a detached pairing session has been stashed for this pairing
     * (cross-device merge — scanner authenticated as a credential other
     * than their live session), the WS authenticates with the detached
     * token. Otherwise falls back to the live `sessionStore` session.
     */
    joinPairing(id: string, pairingCode: string) {
        const detached = detachedPairingSessionStore.getState().detached;
        const walletToken =
            detached && detached.pairingId === id
                ? detached.session.token
                : getSafeSession()?.token;

        if (!walletToken) {
            console.warn("No session found, skipping join");
            return;
        }

        this.forceConnect(() =>
            this.connect({
                action: "join",
                id,
                pairingCode,
                wallet: walletToken,
            })
        );
    }

    /**
     * Reconnect to all the pairings associated with the active credential.
     *
     * A detached pairing session takes precedence over the live
     * `sessionStore` — a refresh mid-detached-merge must keep using the
     * pairing-scoped credential rather than fall back to the user's
     * regular wallet. Uses isAlive() to detect and clean up zombie
     * connections left after the app was backgrounded on mobile.
     */
    reconnect() {
        const detached = detachedPairingSessionStore.getState().detached;
        if (detached) {
            if (this.isAlive()) return;
            this.connect({ wallet: detached.session.token });
            return;
        }

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
                    signatureKind: request.signatureKind,
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

        // Cross-device wallet merge completed. Backend pushes a freshly-
        // minted local-webauthn session on the loser-side topic; winner-side
        // gets an info-only event with no `session`. The mobile (target)
        // side is typically the loser in the winner=desktop branch, so this
        // is where the rebind actually happens.
        //
        // Detached path: the loser credential lived in
        // `detachedPairingSessionStore`, never in the live session. The
        // payload's freshly-minted session targets that detached identity,
        // which is being discarded — the user's actual live session is
        // unrelated to the merge and must not be silently overwritten.
        if (message.type === "merge-completed") {
            const detached = detachedPairingSessionStore.getState().detached;
            if (detached) {
                detachedPairingSessionStore.getState().clearDetachedSession();
                return;
            }
            if (message.payload.session) {
                // Backend's webauthn DTO carries `transports: string[]`,
                // local `Session` narrows to `AuthenticatorTransport[]`.
                // Cast mirrors the same narrowing useMergeSettle relies on.
                const { token, sdkJwt, wallet } = message.payload.session;
                sessionStore
                    .getState()
                    .setSession({ ...wallet, token } as Session);
                sessionStore.getState().setSdkSession(sdkJwt);
            }
            return;
        }
    }

    /**
     * Send back a signature response or rejection to the pairing server.
     *
     * The `signature` payload's encoding is discriminated by the request's
     * original `signatureKind` (preserved here from `pendingSignatures`).
     * `Hex` for the default on-chain flow; base64 WebAuthn assertion JSON
     * `string` for the cross-device merge raw-assertion flow.
     */
    sendSignatureResponse(
        requestId: string,
        response:
            | { signature: Hex | string }
            | { reason: SignatureRejectReason }
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
                    signatureKind: request.signatureKind,
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
