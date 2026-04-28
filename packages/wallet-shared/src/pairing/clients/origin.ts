import { nanoid } from "nanoid";
import type { Hex } from "viem";
import { identifyAuthenticatedUser, trackEvent } from "../../common/analytics";
import { getSafeSession } from "../../common/utils/safeSession";
import { sessionStore } from "../../stores/sessionStore";
import {
    type OriginIdentityNode,
    type OriginPairingState,
    PairingSignatureError,
    type PairingSignatureFailure,
    type SignatureRejectReason,
    type WsOriginMessage,
    type WsOriginRequest,
} from "../types";
import { BasePairingClient } from "./base";

export type OnPairingSuccessCallback = () => void | Promise<void>;

const PING_INTERVAL_MS = 5_000;
const MAX_UNANSWERED_PINGS = 5;

/**
 * Pairing client for the origin device (typically a desktop initiating pairing).
 *
 * Lifecycle:
 *  - `initiatePairing` opens a fresh WS to create a new pairing.
 *  - `reconnect` resumes an existing distant-webauthn session.
 *  - `sendSignatureRequest` returns a Promise that resolves with the
 *    target's signature, or rejects with a typed `PairingSignatureError`.
 *
 * In-flight signature promises survive transient WS closes (network blips,
 * mobile suspends, server restarts). Only fatal closes — auth failures,
 * protocol errors, retry-budget exhaustion — reject pending promises.
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

        this.connect({
            wallet: session.token,
        });
    }

    /**
     * Send a signature request to the paired target device.
     *
     * The returned promise resolves with the signature, or rejects with a
     * typed `PairingSignatureError` (use `cause` to render UX). Pending
     * requests survive transient reconnects — they're only rejected when
     * the connection is permanently lost or the target/server explicitly
     * rejects (declined, cancelled, expired, …).
     *
     * If the WS isn't open right now, the request is queued in the base
     * outbound buffer and flushed when reconnect succeeds. The server
     * dedupes on the request `id` (which doubles as the idempotency key).
     */
    async sendSignatureRequest(request: Hex, context?: object): Promise<Hex> {
        // Reject up-front in states where reconnect won't bring us back
        // (idle = no session yet; error/retry-error = user must take action).
        const status = this.state.status;
        if (
            status === "idle" ||
            status === "error" ||
            status === "retry-error"
        ) {
            throw new PairingSignatureError(
                "connection-lost",
                `Pairing not connected (status: ${status})`
            );
        }

        return new Promise<Hex>((resolve, reject) => {
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
     * Cancel an in-flight signature request because the origin user dismissed
     * the dApp modal / withdrew consent. The pending promise rejects with
     * `cause: "user-cancelled"` and a `signature-reject` message is sent to
     * the server so the target's UI clears.
     */
    cancelSignatureRequest(id: string, detail?: string): boolean {
        const pending = this.state.signatureRequests.get(id);
        if (!pending) return false;

        const reason: SignatureRejectReason = {
            code: "user-cancelled",
            ...(detail ? { detail } : {}),
        };
        this.send({ type: "signature-reject", payload: { id, reason } });
        pending.reject(new PairingSignatureError(reason.code, reason.detail));
        this.removeSignatureRequest(id);
        return true;
    }

    /**
     * Cancel every in-flight signature request — convenience for moments
     * where the origin user clearly abandoned the flow (closed the dApp
     * modal, navigated away, etc.). Sends `signature-reject` for each,
     * settles every pending promise, and returns the count cancelled.
     */
    cancelAllSignatureRequests(detail?: string): number {
        const requests = this.state.signatureRequests;
        if (requests.size === 0) return 0;

        const reason: SignatureRejectReason = {
            code: "user-cancelled",
            ...(detail ? { detail } : {}),
        };
        const error = new PairingSignatureError(reason.code, reason.detail);
        const count = requests.size;

        for (const [id, pending] of requests) {
            this.send({ type: "signature-reject", payload: { id, reason } });
            pending.reject(error);
        }

        this.setState({ signatureRequests: new Map() });
        return count;
    }

    /**
     * Override of base hook — reject every pending signature promise.
     * Called from base `reset()` and from `handleClose` on fatal /
     * retry-budget-exhausted closes.
     */
    protected override rejectAllRequests(
        reason: PairingSignatureFailure
    ): void {
        const requests = this.state.signatureRequests;
        if (requests.size === 0) return;

        for (const { reject } of requests.values()) {
            reject(new PairingSignatureError(reason.code, reason.detail));
        }
        this.setState({ signatureRequests: new Map() });
    }

    /**
     * Override of base hook — when a single `signature-request` is dropped
     * because the outbound queue overflowed, reject ONLY that request's
     * pending promise. Other in-flight signatures stay alive.
     */
    protected override rejectDroppedRequest(
        message: WsOriginRequest,
        reason: PairingSignatureFailure
    ): void {
        if (message.type !== "signature-request") return;
        const id = message.payload.id;
        const pending = this.state.signatureRequests.get(id);
        if (!pending) return;
        pending.reject(new PairingSignatureError(reason.code, reason.detail));
        this.removeSignatureRequest(id);
    }

    /**
     * Override of base hook — (re)start the heartbeat after every successful
     * open, including silent reconnects.
     */
    protected override onSocketOpen(): void {
        this.startPingInterval();
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
            return;
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
                const reason = message.payload.reason;
                request.reject(
                    new PairingSignatureError(reason.code, reason.detail)
                );
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
     * Start the ping interval (called from `onSocketOpen`).
     */
    private startPingInterval() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
        }

        this.pingInterval = setInterval(() => {
            // If we got more than MAX_UNANSWERED_PINGS pending pings, force-close.
            // The base class's `handleClose` will treat the resulting code as
            // transient and silently reconnect (heartbeat-driven liveness check).
            if (this.pendingPings > MAX_UNANSWERED_PINGS) {
                this.connection?.close();
                this.connection = null;
                this.pendingPings = 0;
                return;
            }

            this.send({ type: "ping" });
            this.pendingPings++;
        }, PING_INTERVAL_MS);
    }
}
