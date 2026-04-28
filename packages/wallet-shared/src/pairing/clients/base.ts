import type { Treaty } from "@elysiajs/eden";
import type { StoreApi } from "zustand/vanilla";
import { createStore } from "zustand/vanilla";
import { authenticatedWalletApi } from "../../common/api/backendClient";
import { sessionStore } from "../../stores/sessionStore";
import {
    type BasePairingState,
    isRetryableCloseCode,
    isSilentCloseCode,
    type OriginIdentityNode,
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
     * Update the state
     */
    protected updateState(updater: (state: TState) => TState) {
        this._store.setState(updater);
    }

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
        this.connection = null;
        this.resetReconnectState();
        this.cleanupConnection();
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
        this.setState({ status: "connecting" } as Partial<TState>);

        this.setupEventListeners();
    }

    /**
     * Force a connection to the pairing websocket, if already open, close it and reconnect
     */
    protected forceConnect(connectFn: () => void) {
        // If no connection, directly connect
        if (!this.connection) {
            connectFn();
            return;
        }

        // If connection obj is here, but the ws is closed, cleanup and reconnect
        if (this.connection.ws.readyState === WebSocket.CLOSED) {
            this.connection = null;
            this.cleanup();
            connectFn();
            return;
        }

        // If we already got a onCloseHook, exit
        if (this.onCloseHook) {
            console.warn("Already waiting for WS to close, skipping");
            return;
        }

        // If connection is open, and not in a closed state, close it and save the connectFn in the onCloseHook
        this.connection.close();
        this.onCloseHook = connectFn;
    }

    /**
     * Reconnect to the pairing websocket
     */
    abstract reconnect(): void;

    /**
     * Setup the event listeners for the pairing websocket
     */
    protected setupEventListeners() {
        if (!this.connection) return;

        this.connection.on(
            "message",
            ({ data }: { data: unknown }) => {
                console.log("Received message", data);
                // Ensure the data is a valid message
                if (!this.isWsMessageData(data)) {
                    console.error("Invalid message received", data);
                    return;
                }

                // Handle the message
                this.handleMessage(data);
            },
            {}
        );

        this.connection.on("open", () => {
            console.log("Pairing websocket opened");
            this.resetReconnectState();
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
     * Send a message to the pairing websocket
     */
    protected send(message: TRequest) {
        this.connection?.send(message);
    }

    /**
     * Cleanup the pairing websocket
     */
    protected cleanup() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }

        // Reput the state to initial state
        this.setState(this.getInitialState());
    }

    /**
     * Lightweight cleanup that only clears the ping interval without
     * resetting store state. Used by isAlive() to avoid a UI flash
     * (idle → connecting) when recovering from a zombie connection.
     */
    protected cleanupConnection() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }

    private handleClose({ code, reason }: CloseEvent) {
        console.log("Pairing websocket closed", { code, reason });
        this.cleanup();
        this.connection = null;

        if (this.onCloseHook) {
            this.onCloseHook();
            this.onCloseHook = null;
            return;
        }

        if (isSilentCloseCode(code)) {
            // Expected non-error termination (e.g. wallet has no pairings yet).
            // Drop back to idle without any UI feedback.
            this.setState({
                status: "idle",
                closeInfo: { code, reason },
            } as Partial<TState>);
            this.resetReconnectState();
            return;
        }

        if (!isRetryableCloseCode(code)) {
            // Non-retryable error — surface it so the user sees what went wrong
            // and can take action (typically a manual refresh / re-auth).
            this.setState({
                status: "error",
                closeInfo: { code, reason },
            } as Partial<TState>);
            this.resetReconnectState();
            return;
        }

        if (this.reconnectBudgetStart === null) {
            this.reconnectBudgetStart = Date.now();
        }

        const elapsed = Date.now() - this.reconnectBudgetStart;
        if (elapsed > RECONNECT_RETRY_BUDGET_MS) {
            console.warn(
                `Reconnect budget exhausted after ${Math.round(elapsed / 1000)}s`
            );
            this.setState({
                status: "retry-error",
                closeInfo: { code, reason },
            } as Partial<TState>);
            this.resetReconnectState();
            return;
        }

        const delay = computeBackoffDelay(this.reconnectRetryCount);
        this.reconnectRetryCount++;

        setTimeout(() => {
            this.reconnect();
        }, delay);
    }

    private resetReconnectState() {
        this.reconnectRetryCount = 0;
        this.reconnectBudgetStart = null;
    }

    /**
     * Disconnect from the pairing websocket
     */
    disconnect() {
        this.connection?.close();
        this.cleanup();
    }

    /**
     * Hard reset: disconnect the WS, clear the local session token, and put
     * the client back into its initial state. Used as the recovery action
     * after a non-retryable server rejection (e.g. 4401 invalid token) so the
     * app can route the user back to a fresh sign-in flow.
     */
    reset() {
        this.connection?.close();
        this.cleanup();
        sessionStore.getState().clearSession();
    }

    protected isWsMessageData(data: unknown): data is TMessage {
        return typeof data === "object" && data !== null && "type" in data;
    }
}
