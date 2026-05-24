import type { WsSignatureKind } from "@frak-labs/backend-elysia/domain/pairing";
import { nanoid } from "nanoid";
import type { Hex } from "viem";
import {
    createJSONStorage,
    persist,
    type StateStorage,
} from "zustand/middleware";
import { createStore, type StoreApi } from "zustand/vanilla";
import { identifyAuthenticatedUser, trackEvent } from "../../common/analytics";
import { getSafeSession } from "../../common/utils/safeSession";
import { detachedPairingSessionStore } from "../../stores/detachedPairingSessionStore";
import { sessionStore } from "../../stores/sessionStore";
import type { Session } from "../../types/Session";
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

/**
 * App-defined WS close code mirroring
 * `WsCloseCode.RESUME_TOKEN_EXPIRED` from the backend. Imported as a
 * literal to avoid a runtime dep on the backend module from the shared
 * package; if the backend ever changes the value, the test for
 * `auto-reinitiate` will catch the drift.
 */
const RESUME_TOKEN_EXPIRED_CODE = 4407;

export type OnPairingSuccessCallback = () => void | Promise<void>;

/**
 * Options accepted by `OriginPairingClient.initiatePairing`. Held verbatim
 * for transparent re-initiation when the server signals that the current
 * pairing is gone (RESUME_TOKEN_EXPIRED).
 */
export type InitiatePairingOptions = {
    onSuccess?: OnPairingSuccessCallback;
    originNode?: OriginIdentityNode;
    /**
     * Pin the pairing to a specific WebAuthn credential id. Backend rejects
     * any joiner that authenticates with a different credential. Used by
     * the cross-device wallet merge to guarantee the paired device is the
     * wallet whose passkey actually needs to participate.
     */
    authenticatorHint?: string;
    /**
     * When true, the minted distant-webauthn session is written to the
     * tab-scoped `detachedPairingSessionStore` instead of the live
     * `sessionStore`. The user's active wallet session stays in place; the
     * pairing credentials live alongside it just long enough to sign the
     * merge ceremony. Reserved for flows that explicitly opt in — the
     * cross-device wallet merge today, and nothing else.
     *
     * Defaults to `false`, which preserves the legacy "this device becomes
     * the paired wallet" behaviour used by SSO / login / onboarding / the
     * listener auth surfaces.
     */
    detached?: boolean;
};

const PING_INTERVAL_MS = 5_000;
const MAX_UNANSWERED_PINGS = 5;

/**
 * Storage key for the in-flight pairing state. Scoped to sessionStorage so
 * the resume capability survives WS closes / tab refreshes during pairing,
 * but doesn't leak across browser sessions.
 */
const PAIRING_STORAGE_KEY = "frak_pairing_in_flight";

/**
 * TTL for the persisted in-flight pairing. Mirrors the backend cleanup
 * window for unresolved pairings (10 minutes idle). Older entries are
 * dropped on hydration so we don't try to resume a pairing that the
 * server has already GC'd.
 */
const PAIRING_PERSIST_TTL_MS = 10 * 60 * 1_000;

/**
 * sessionStorage adapter that wraps every value with a timestamp and drops
 * entries older than {@link PAIRING_PERSIST_TTL_MS} on read. Returns null
 * (no persisted state) in non-browser contexts.
 */
const sessionStorageWithTtl: StateStorage = {
    getItem: (name) => {
        if (typeof window === "undefined") return null;
        const raw = window.sessionStorage.getItem(name);
        if (!raw) return null;
        try {
            const { value, persistedAt } = JSON.parse(raw) as {
                value: string;
                persistedAt: number;
            };
            if (Date.now() - persistedAt > PAIRING_PERSIST_TTL_MS) {
                window.sessionStorage.removeItem(name);
                return null;
            }
            return value;
        } catch {
            window.sessionStorage.removeItem(name);
            return null;
        }
    },
    setItem: (name, value) => {
        if (typeof window === "undefined") return;
        window.sessionStorage.setItem(
            name,
            JSON.stringify({ value, persistedAt: Date.now() })
        );
    },
    removeItem: (name) => {
        if (typeof window === "undefined") return;
        window.sessionStorage.removeItem(name);
    },
};

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
     * Last options passed to `initiatePairing()`. Held so the client can
     * transparently re-initiate when the server signals that the current
     * pairing/token is gone (RESUME_TOKEN_EXPIRED). Cleared on `reset()`.
     */
    private lastInitiateOptions: InitiatePairingOptions | null = null;

    constructor() {
        super();

        // Auto-resume any in-flight pairing recovered from sessionStorage.
        // The persist middleware hydrates synchronously; if we still have a
        // pending `pairing` after construction, kick off a reconnect that the
        // base class can route to either the resume action (no session yet)
        // or the regular session-based path. Defer to a microtask so the
        // constructor finishes before any WS work begins.
        if (this.state.pairing) {
            queueMicrotask(() => this.reconnect());
        }
    }

    /**
     * Wrap the Zustand store with the `persist` middleware so the in-flight
     * pairing (id + code) survives transient WS closes and tab refreshes.
     * Other state — in particular the `signatureRequests` Map and the
     * `partnerDevice` — is intentionally NOT persisted; only the data
     * needed to resume the pairing handshake is kept.
     */
    protected override createPairingStore(): StoreApi<OriginPairingState> {
        return createStore<OriginPairingState>()(
            persist(() => this.getInitialState(), {
                name: PAIRING_STORAGE_KEY,
                storage: createJSONStorage(() => sessionStorageWithTtl),
                partialize: (state) => ({
                    pairing: state.pairing,
                }),
            })
        );
    }

    /**
     * Get the initial state for the client
     */
    protected getInitialState(): OriginPairingState {
        return {
            partnerDevice: null,
            status: "idle",
            signatureRequests: new Map(),
            closeInfo: undefined,
            // Explicitly undefined so a Zustand shallow merge
            // (`{ ...prev, ...initial }`) actually clears any stale pairing
            // — omitting the key would let the previous value survive.
            pairing: undefined,
        };
    }

    /**
     * Override of base hook — also clear stashed initiate options. Runs on
     * both soft and hard resets (the base `reset` dispatches through
     * `this.softReset`), so any leftover options would be misleading once
     * the consumer is back to an idle client.
     */
    override softReset(): void {
        this.lastInitiateOptions = null;
        this.onPairingSuccess = null;
        super.softReset();
    }

    async initiatePairing(options?: InitiatePairingOptions) {
        this.onPairingSuccess = options?.onSuccess ?? null;
        this.lastInitiateOptions = options ?? {};

        this.forceConnect(() =>
            this.connect({
                action: "initiate",
                originNode: options?.originNode,
                authenticatorHint: options?.authenticatorHint,
            })
        );
    }

    /**
     * Reconnect to the pairing websocket.
     *
     * Four paths, in priority order:
     *  - detached pairing session present — reconnect using its token. Takes
     *    precedence over the live `sessionStore` because a refresh
     *    mid-detached-merge must keep the pairing-scoped credential, not
     *    fall back to the user's regular wallet.
     *  - distant-webauthn session present in `sessionStore` — reconnect with
     *    the wallet token (the standard already-paired flow).
     *  - no session but `pairing` state persisted — origin is mid-handshake
     *    and the WS dropped before the target authenticated. Use the resume
     *    action with the pairingId/code to re-attach to the topic.
     *  - neither — nothing to do.
     *
     * Uses isAlive() to detect and clean up zombie connections left after
     * the app was backgrounded on mobile.
     */
    reconnect() {
        const detached = detachedPairingSessionStore.getState().detached;
        if (detached) {
            if (this.isAlive()) return;
            this.pendingPings = 0;
            this.connect({ wallet: detached.session.token });
            return;
        }

        const session = getSafeSession();

        if (session && session.type === "distant-webauthn") {
            if (this.isAlive()) return;
            this.pendingPings = 0;
            this.connect({ wallet: session.token });
            return;
        }

        // No usable session — fall back to resume if we have an in-flight
        // pairing recovered from sessionStorage.
        const pending = this.state.pairing;
        if (pending) {
            if (this.isAlive()) return;
            this.pendingPings = 0;
            this.connect({
                action: "resume",
                originResumeToken: pending.originResumeToken,
            });
            return;
        }

        if (session) {
            console.warn(
                "Not a distant-webauthn session, skipping reconnection"
            );
            return;
        }

        console.warn("No session or in-flight pairing, skipping reconnection");
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
     *
     * The resolved value depends on the `signatureKind` option:
     *  - `"onchain"` (default, omitted on the wire for legacy clients):
     *    target returns the `formatSignature`-wrapped on-chain blob ready
     *    to plug into a userOp.
     *  - `"raw-assertion"`: target returns the base64 WebAuthn assertion
     *    JSON `{id, response: {metadata, signature}}` parseable by
     *    `WebAuthNService.verifyConsentSignature`. Used by the cross-device
     *    merge winner-side flow to ferry the loser's consent assertion.
     */
    async sendSignatureRequest(
        request: Hex,
        options?: { context?: object; signatureKind?: "onchain" }
    ): Promise<Hex>;
    async sendSignatureRequest(
        request: Hex,
        options: { context?: object; signatureKind: "raw-assertion" }
    ): Promise<string>;
    async sendSignatureRequest(
        request: Hex,
        options?: { context?: object; signatureKind?: WsSignatureKind }
    ): Promise<Hex | string> {
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

        return new Promise<Hex | string>((resolve, reject) => {
            const id = nanoid(16);

            const signatureRequests = new Map(this.state.signatureRequests);
            signatureRequests.set(id, { resolve, reject });
            this.setState({ signatureRequests });

            this.send({
                type: "signature-request",
                payload: {
                    id,
                    request,
                    context: options?.context,
                    signatureKind: options?.signatureKind,
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

    /**
     * Override of base hook — a `RESUME_TOKEN_EXPIRED` close means the server
     * dropped the pairing (TTL exceeded) or our resume token aged out of its
     * 10-minute window. Either way, the right answer is to silently obtain a
     * fresh pairing using the same options the consumer passed to the last
     * `initiatePairing()` call. If we have no stashed options (e.g. tab
     * refresh + auto-resume + token expired before the component mounted
     * and called `initiatePairing()`), fall back to the default error path
     * by returning false.
     */
    protected override handleFatalClose(code: number): boolean {
        if (code !== RESUME_TOKEN_EXPIRED_CODE) return false;

        // Wipe the stale `pairing` state synchronously so the next
        // `initiatePairing()` doesn't read it back from the persisted store.
        this.setState({ ...this.getInitialState() });

        const opts = this.lastInitiateOptions;
        if (!opts) return false;

        // Defer the re-initiate so we leave the close handler before opening
        // a new WS — keeps the WS lifecycle linear.
        queueMicrotask(() => {
            void this.initiatePairing(opts);
        });
        return true;
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
                    originResumeToken: message.payload.originResumeToken,
                },
            });
            return;
        }

        if (message.type === "signature-response") {
            const request = this.state.signatureRequests.get(
                message.payload.id
            );
            if (request) {
                // `signature` is `Hex` for `signatureKind: "onchain"` and a
                // base64 WebAuthn assertion `string` for `"raw-assertion"`.
                // The caller picked the overload that matches the kind it
                // asked for, so the union here is safe to forward as-is.
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

        if (message.type === "authenticated") {
            this.handleAuthenticated(message.payload);
            return;
        }

        if (message.type === "merge-completed") {
            this.handleMergeCompleted(message.payload);
            return;
        }
    }

    /**
     * Handle a successful pairing handshake. Writes the minted
     * distant-webauthn session into `sessionStore` and forces a reconnect
     * with the new token so the WS keeps flowing as the joined wallet.
     */
    private handleAuthenticated(
        payload: Extract<WsOriginMessage, { type: "authenticated" }>["payload"]
    ) {
        // Keep `pairing.id` around past `authenticated` so consumers can
        // still reference the pairing for downstream cross-device flows.
        // `reconnect()` already prefers the distant-webauthn session path
        // over the resume action, so a lingering `pairing` is harmless; it
        // is fully cleared by `reset()` via `resetState()`.
        this.setState({ status: "paired" });

        this.applyDistantSession(payload);

        identifyAuthenticatedUser(payload.wallet);
        trackEvent("pairing_completed");

        this.forceConnect(() => this.reconnect());

        this.onPairingSuccess?.();
    }

    /**
     * Apply the freshly minted distant-webauthn session.
     *
     * Two branches based on `lastInitiateOptions.detached`:
     *  - `detached: true` (cross-device merge) — write into the tab-scoped
     *    `detachedPairingSessionStore`. The user's live wallet session in
     *    `sessionStore` stays untouched; the pairing credential lives
     *    alongside it for the duration of the merge.
     *  - `detached: false` or omitted (SSO / login / onboarding / listener
     *    auth) — overwrite the live `sessionStore` slot. The user has
     *    explicitly opted in to becoming the paired wallet on this device,
     *    so the prior session is intentionally replaced.
     */
    private applyDistantSession(
        payload: Extract<WsOriginMessage, { type: "authenticated" }>["payload"]
    ) {
        const session: Session = {
            token: payload.token,
            ...payload.wallet,
        };

        if (this.lastInitiateOptions?.detached) {
            detachedPairingSessionStore.getState().setDetachedSession({
                pairingId: payload.wallet.pairingId,
                session,
                sdkSession: payload.sdkJwt,
            });
            return;
        }

        sessionStore.getState().setSession(session);
        sessionStore.getState().setSdkSession(payload.sdkJwt);
    }

    /**
     * Cross-device wallet merge completed. Pushed by the backend on both
     * pairing topics after `WalletMergeOrchestrator.settle` succeeds.
     *
     * On the origin (desktop initiator) side we only need to clean up
     * pairing-scoped state — the detached pairing slot, and the in-flight
     * `pairing` block so a refresh doesn't trigger a stale resume against
     * a finalised handshake. Any live-session refresh the desktop needs
     * (i.e. when desktop authenticated with the loser credential) is
     * delivered synchronously through the `/merge/settle` HTTP response
     * and applied by {@link useMergeSettle}; we deliberately do NOT touch
     * `sessionStore` here. The payload's `session` is for the loser-side
     * topic on the cross-device flow — origin is never the receiver of
     * that refresh in the detached architecture.
     */
    private handleMergeCompleted(
        _payload: Extract<
            WsOriginMessage,
            { type: "merge-completed" }
        >["payload"]
    ) {
        this.setState({ pairing: undefined });
        detachedPairingSessionStore.getState().clearDetachedSession();
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
