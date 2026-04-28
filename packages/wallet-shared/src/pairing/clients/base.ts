import type { Treaty } from "@elysiajs/eden";
import type { StoreApi } from "zustand/vanilla";
import { createStore } from "zustand/vanilla";
import { authenticatedWalletApi } from "../../common/api/backendClient";
import { sessionStore } from "../../stores/sessionStore";
import {
    type BasePairingState,
    classifyClose,
    type OriginIdentityNode,
    type PairingSignatureFailure,
    type WsOriginMessage,
    type WsOriginRequest,
    type WsTargetMessage,
    type WsTargetRequest,
} from "../types";

type PairingWs = ReturnType<
    typeof authenticatedWalletApi.pairings.ws.subscribe
>;

export type PairingWsEventListener = (
    event: Treaty.WSEvent<"message", unknown>
) => void;

type ConnectionParams =
    | {
          action: "initiate";
          originNode?: OriginIdentityNode;
      }
    | {
          action: "join";
          id: string;
          pairingCode: string;
          wallet: string;
      }
    | {
          wallet: string;
      };

/**
 * Reconnection backoff configuration.
 *
 * Uses exponential backoff with full jitter:
 *   delay = random(0, min(MAX_DELAY, BASE_DELAY * 2^attempt))
 *
 * Combined with a time-based retry budget: instead of a hard retry cap,
 * we keep retrying for up to RETRY_BUDGET_MS while the app is in the
 * foreground. This is critical for mobile wallets where connectivity
 * can be lost for several seconds during cell handoffs.
 */
const RECONNECT_BASE_DELAY_MS = 1_000;
const RECONNECT_MAX_DELAY_MS = 30_000;
const RECONNECT_RETRY_BUDGET_MS = 2 * 60 * 1_000; // 2 minutes

/**
 * Outbound queue cap. Bounded to keep memory in check during prolonged
 * offline periods; exceeding this rejects pending signature requests with
 * `connection-lost` so the dApp UI doesn't hang.
 */
const MAX_OUTBOUND_QUEUE_SIZE = 10;

function computeBackoffDelay(attempt: number): number {
    const exponentialDelay = Math.min(
        RECONNECT_MAX_DELAY_MS,
        RECONNECT_BASE_DELAY_MS * 2 ** attempt
    );
    // Full jitter: pick a random value in [0, exponentialDelay]
    return Math.round(Math.random() * exponentialDelay);
}

export abstract class BasePairingClient<
    TRequest extends WsOriginRequest | WsTargetRequest,
    TMessage extends WsOriginMessage | WsTargetMessage,
    TState extends BasePairingState = BasePairingState,
> {
    protected connection: PairingWs | null = null;
    protected pingInterval: NodeJS.Timeout | null = null;

    private onCloseHook: (() => void) | null = null;
    private reconnectRetryCount = 0;
    /**
     * Timestamp of the first reconnect attempt in the current retry window.
     * Used to enforce the time-based retry budget.
     */
    private reconnectBudgetStart: number | null = null;

    /**
     * Outbound message queue. Filled while the socket is closed/reconnecting,
     * flushed on `open`. Each entry must carry an `id` so the server can
     * dedupe in case a message was actually delivered before the close.
     */
    private outbound: TRequest[] = [];

    /**
     * The Zustand store for the pairing client
     */
    protected _store: StoreApi<TState>;

    constructor() {
        this._store = createStore<TState>()(() => this.getInitialState());
    }

    /**
     * Get the initial state for the client
     */
    protected abstract getInitialState(): TState;

    /**
     * Get the Zustand store (for React hooks integration)
     */
    get store(): StoreApi<TState> {
        return this._store;
    }

    /**
     * Get the current state
     */
    get state(): TState {
        return this._store.getState();
    }

    /**
     * Update the state
     */
    protected setState(newState: Partial<TState>) {
        this._store.setState((prev) => ({ ...prev, ...newState }));
    }

    /**
     * Update the state via a reducer.
     */
    protected updateState(updater: (state: TState) => TState) {
        this._store.setState(updater);
    }

    /* ---------------------------------------------------------------------- */
    /*                          Lifecycle primitives                          */
    /* ---------------------------------------------------------------------- */

    /** Stop the heartbeat ping timer. */
    private stopHeartbeat() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }

    /** Close the socket (if any) and clear local connection refs. */
    private closeSocket() {
        this.connection?.close();
        this.connection = null;
        this.stopHeartbeat();
    }

    /** Reset the Zustand state to its initial shape. */
    private resetState() {
        this.setState(this.getInitialState());
    }

    /**
     * Reject every in-flight signature request with the given reason.
     * Subclasses iterate their per-request maps; the base also drops the
     * outbound queue.
     *
     * Default implementation is a no-op for subclasses (e.g. target) that
     * don't keep promise-bearing requests.
     */
    protected rejectAllRequests(_reason: PairingSignatureFailure): void {
        // Subclasses override.
    }

    /**
     * Reject the per-request state associated with a single queued message
     * that we just had to drop (outbound queue overflow). Subclasses with
     * promise-bearing request types (e.g. origin's `signature-request`)
     * override this so we settle ONLY the dropped request rather than
     * nuking every other in-flight one.
     */
    protected rejectDroppedRequest(
        _message: TRequest,
        _reason: PairingSignatureFailure
    ): void {
        // Subclasses override.
    }

    /**
     * Subclass hook fired after the socket is open and the outbound queue
     * has been flushed. Useful to (re)start the heartbeat after reconnect.
     */
    protected onSocketOpen(): void {
        // Subclasses override.
    }

    /** Drop the outbound queue and reject in-flight requests. */
    private rejectPending(reason: PairingSignatureFailure) {
        this.outbound = [];
        this.rejectAllRequests(reason);
    }

    /* ---------------------------------------------------------------------- */
    /*                          Public surface                                 */
    /* ---------------------------------------------------------------------- */

    /**
     * Graceful disconnect. Closes the WS but keeps Zustand state and any
     * in-flight requests untouched — caller may choose to reconnect later.
     */
    disconnect() {
        this.closeSocket();
    }

    /**
     * Hard reset: close the WS, reject any pending requests, clear the
     * local session token, and put the client back into its initial state.
     * Used as the recovery action after a non-retryable server rejection
     * (e.g. 4401 invalid token) so the app can route the user back to a
     * fresh sign-in flow.
     */
    reset() {
        this.closeSocket();
        this.rejectPending({
            code: "connection-lost",
            detail: "client reset",
        });
        this.resetState();
        sessionStore.getState().clearSession();
    }

    /** Reconnect to the pairing websocket. Subclass-specific. */
    abstract reconnect(): void;

    /* ---------------------------------------------------------------------- */
    /*                          Connection management                          */
    /* ---------------------------------------------------------------------- */

    /**
     * Check WebSocket liveness, cleaning up zombie connections.
     * A zombie occurs when the OS kills the socket while the app is backgrounded
     * without firing a close event — the connection object lingers in CLOSED state.
     *
     * Returns true if connection is active or closing (let close handler finish).
     */
    protected isAlive(): boolean {
        if (!this.connection) return false;

        const { readyState } = this.connection.ws;

        // Active, handshaking, or tearing down — leave it alone
        if (
            readyState === WebSocket.OPEN ||
            readyState === WebSocket.CONNECTING ||
            readyState === WebSocket.CLOSING
        ) {
            return true;
        }

        console.log("[Pairing] Cleaning up zombie WebSocket connection");
        // Zombie: socket is CLOSED but no close event fired. Drop the ref
        // and reset reconnect counters, but DO NOT reset state — the caller
        // is expected to re-establish the connection silently.
        this.connection = null;
        this.stopHeartbeat();
        this.resetReconnectState();
        return false;
    }

    protected connect(params: ConnectionParams) {
        if (this.connection) {
            console.warn("Pairing client is already connected");
            return;
        }

        const query =
            "originNode" in params && params.originNode
                ? {
                      ...params,
                      originNode: btoa(JSON.stringify(params.originNode)),
                  }
                : params;

        this.connection = authenticatedWalletApi.pairings.ws.subscribe({
            query,
        });

        // Only flip status to "connecting" if we're not already in a
        // connected state. Silent reconnects after a transient close keep
        // status at "paired" so the UI doesn't flicker.
        if (this.state.status !== "paired") {
            this.setState({ status: "connecting" } as Partial<TState>);
        }

        this.setupEventListeners();
    }

    /**
     * Force a connection to the pairing websocket — if already open, close it
     * and reconnect.
     */
    protected forceConnect(connectFn: () => void) {
        if (!this.connection) {
            connectFn();
            return;
        }

        // If connection obj is here, but the ws is closed, cleanup and reconnect
        if (this.connection.ws.readyState === WebSocket.CLOSED) {
            this.connection = null;
            this.stopHeartbeat();
            connectFn();
            return;
        }

        if (this.onCloseHook) {
            console.warn("Already waiting for WS to close, skipping");
            return;
        }

        this.connection.close();
        this.onCloseHook = connectFn;
    }

    /* ---------------------------------------------------------------------- */
    /*                          Event handling                                 */
    /* ---------------------------------------------------------------------- */

    protected setupEventListeners() {
        if (!this.connection) return;

        this.connection.on(
            "message",
            ({ data }: { data: unknown }) => {
                console.log("Received message", data);
                if (!this.isWsMessageData(data)) {
                    console.error("Invalid message received", data);
                    return;
                }
                this.handleMessage(data);
            },
            {}
        );

        this.connection.on("open", () => {
            console.log("Pairing websocket opened");
            this.resetReconnectState();
            this.flushOutbound();
            this.onSocketOpen();
        });

        this.connection.on("close", (event: CloseEvent) =>
            this.handleClose(event)
        );

        this.connection.on("error", (error: Event) => {
            console.warn("Pairing websocket error", error);
            this.connection?.close();
        });
    }

    /**
     * Handle a message from the pairing websocket
     */
    protected abstract handleMessage(message: TMessage): void;

    /**
     * Send a message to the pairing websocket. Queues if the socket isn't
     * currently open — `flushOutbound` will replay on reconnect.
     */
    protected send(message: TRequest) {
        if (this.connection?.ws.readyState === WebSocket.OPEN) {
            this.connection.send(message);
            return;
        }

        if (this.outbound.length >= MAX_OUTBOUND_QUEUE_SIZE) {
            // Drop the OLDEST message (most likely the user has given up on it)
            // to make room for the new one. Reject only that specific request,
            // not every other in-flight signature — the rest are still alive.
            const dropped = this.outbound.shift();
            console.warn(
                "[Pairing] Outbound queue overflow — dropping oldest message"
            );
            if (dropped) {
                this.rejectDroppedRequest(dropped, {
                    code: "connection-lost",
                    detail: "outbound queue overflow",
                });
            }
        }
        this.outbound.push(message);
    }

    private flushOutbound() {
        if (!this.connection) return;
        while (
            this.outbound.length > 0 &&
            this.connection.ws.readyState === WebSocket.OPEN
        ) {
            const next = this.outbound.shift();
            if (next) this.connection.send(next);
        }
    }

    private handleClose({ code, reason }: CloseEvent) {
        console.log("Pairing websocket closed", { code, reason });
        this.stopHeartbeat();
        this.connection = null;

        if (this.onCloseHook) {
            this.onCloseHook();
            this.onCloseHook = null;
            return;
        }

        const cls = classifyClose(code);

        if (cls === "silent" || cls === "normal") {
            // Drop back to idle without UI feedback. No requests should be
            // in flight at this point in normal flows; if there are, the
            // caller is responsible for cancelling them.
            this.setState({
                status: "idle",
                closeInfo: { code, reason },
            } as Partial<TState>);
            this.resetReconnectState();
            return;
        }

        if (cls === "fatal") {
            // Non-retryable error — surface it so the user sees what went wrong
            // and can take action (typically a manual refresh / re-auth).
            this.rejectPending({
                code: "connection-lost",
                detail: reason || `ws-${code}`,
            });
            this.setState({
                ...this.getInitialState(),
                status: "error",
                closeInfo: { code, reason },
            } as Partial<TState>);
            this.resetReconnectState();
            return;
        }

        // cls === "transient" — silent reconnect with backoff.
        // CRITICAL: do NOT touch signatureRequests, partnerDevice, or
        // pairingIdState here. Pending requests must survive the reconnect.
        if (this.reconnectBudgetStart === null) {
            this.reconnectBudgetStart = Date.now();
        }

        const elapsed = Date.now() - this.reconnectBudgetStart;
        if (elapsed > RECONNECT_RETRY_BUDGET_MS) {
            console.warn(
                `Reconnect budget exhausted after ${Math.round(elapsed / 1000)}s`
            );
            this.rejectPending({
                code: "connection-lost",
                detail: `retry budget exhausted (${reason || `ws-${code}`})`,
            });
            this.setState({
                ...this.getInitialState(),
                status: "retry-error",
                closeInfo: { code, reason },
            } as Partial<TState>);
            this.resetReconnectState();
            return;
        }

        const delay = computeBackoffDelay(this.reconnectRetryCount);
        this.reconnectRetryCount++;
        // Surface the close info so the UI can opt into showing a banner,
        // but DO NOT change `status` — keep it whatever it was so transient
        // drops are invisible to the user.
        this.setState({ closeInfo: { code, reason } } as Partial<TState>);
        setTimeout(() => this.reconnect(), delay);
    }

    private resetReconnectState() {
        this.reconnectRetryCount = 0;
        this.reconnectBudgetStart = null;
    }

    protected isWsMessageData(data: unknown): data is TMessage {
        return typeof data === "object" && data !== null && "type" in data;
    }
}

// Re-export so subclasses can throw / wrap typed signature errors without
// pulling them from a separate path.
export { PairingSignatureError } from "../types";
