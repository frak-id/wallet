import type { Treaty } from "@elysiajs/eden";
import { authenticatedBackendApi } from "../../common/api/backendClient";
import type { WsMessage } from "../types";

type PairingWs = ReturnType<
    typeof authenticatedBackendApi.pairings.ws.subscribe
>;

export type PairingWsEventListener = (
    event: Treaty.WSEvent<"message", unknown>
) => void;

type ConnectionParams =
    | {
          action: "initiate";
      }
    | {
          action: "join";
          pairingCode: string;
      };

export abstract class BasePairingClient {
    protected connection: PairingWs | null = null;
    protected pingInterval: NodeJS.Timeout | null = null;

    /**
     * Connect to the pairing websocket
     */
    protected async connect(params?: ConnectionParams) {
        this.connection = authenticatedBackendApi.pairings.ws.subscribe({
            query: params,
        });

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
                // Ensure the data is a valid message
                if (!isWsMessageData(data)) {
                    console.error("Invalid message received", data);
                    return;
                }

                // Handle the message
                this.handleMessage(data as WsMessage);
            },
            {}
        );

        this.connection.on("close", () => {
            this.cleanup();
        });

        this.connection.on("error", (error) => {
            console.error("Pairing websocket error", error);
            this.cleanup();
        });

        this.setupHook(this.connection);
    }

    /**
     * Setup the hook for the pairing websocket
     */
    protected abstract setupHook(connection: PairingWs): void;

    /**
     * Handle a message from the pairing websocket
     */
    protected abstract handleMessage(message: WsMessage): void;

    /**
     * Send a message to the pairing websocket
     */
    protected send(message: WsMessage) {
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
    }

    /**
     * Disconnect from the pairing websocket
     */
    disconnect() {
        this.connection?.close();
        this.cleanup();
    }
}

export function isWsMessageData(data: unknown): data is WsMessage {
    return typeof data === "object" && data !== null && "type" in data;
}
