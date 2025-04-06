import type { Treaty } from "@elysiajs/eden";
import { jotaiStore } from "@frak-labs/shared/module/atoms/store";
import {
    type Atom,
    type SetStateAction,
    type WritableAtom,
    atom,
} from "jotai/vanilla";
import type { Hex } from "viem";
import { authenticatedBackendApi } from "../../common/api/backendClient";
import { getSafeSession } from "../../listener/utils/localStorage";
import type {
    BasePairingState,
    WsOriginMessage,
    WsOriginRequest,
    WsTargetMessage,
    WsTargetRequest,
} from "../types";

type PairingWs = ReturnType<
    typeof authenticatedBackendApi.pairings.ws.subscribe
>;

export type PairingWsEventListener = (
    event: Treaty.WSEvent<"message", unknown>
) => void;

type ConnectionParams =
    | {
          action: "initiate";
          ssoId?: Hex;
      }
    | {
          action: "join";
          id: string;
          pairingCode: string;
      };

export abstract class BasePairingClient<
    TRequest extends WsOriginRequest | WsTargetRequest,
    TMessage extends WsOriginMessage | WsTargetMessage,
    TState extends BasePairingState = BasePairingState,
> {
    protected connection: PairingWs | null = null;
    protected pingInterval: NodeJS.Timeout | null = null;

    /**
     * The base state of the pairing client
     */
    protected _state: WritableAtom<TState, [SetStateAction<TState>], void>;

    constructor() {
        this._state = atom(this.getInitialState());
    }

    /**
     * Get the initial state for the client
     */
    protected abstract getInitialState(): TState;

    /**
     * Get the current state
     */
    get stateAtom(): Atom<TState> {
        return this._state;
    }
    get state(): TState {
        return jotaiStore.get(this._state);
    }

    /**
     * Update the state
     */
    protected setState(newState: Partial<TState>) {
        jotaiStore.set(this._state, (prev) => ({ ...prev, ...newState }));
    }

    /**
     * Update the state
     */
    protected updateState(updater: (state: TState) => TState) {
        jotaiStore.set(this._state, updater);
    }

    /**
     * Connect to the pairing websocket
     */
    protected connect(params?: ConnectionParams) {
        if (this.connection) {
            console.warn("Pairing client is already connected");
            return;
        }

        this.connection = authenticatedBackendApi.pairings.ws.subscribe({
            query: {
                ...params,
                wallet: getSafeSession()?.token,
            },
        });
        this.setState({ status: "connecting" } as Partial<TState>);

        this.setupEventListeners();
    }

    /**
     * Setup the event listeners for the pairing websocket
     */
    protected setupEventListeners() {
        if (!this.connection) return;

        this.connection.on(
            "message",
            ({ data }) => {
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

        this.connection.on("close", () => {
            console.log("Pairing websocket closed");
            this.cleanup();
            this.connection = null;
        });

        this.connection.on("error", (error) => {
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
     * Disconnect from the pairing websocket
     */
    disconnect() {
        this.connection?.close();
        this.cleanup();
    }

    protected isWsMessageData(data: unknown): data is TMessage {
        return typeof data === "object" && data !== null && "type" in data;
    }
}
