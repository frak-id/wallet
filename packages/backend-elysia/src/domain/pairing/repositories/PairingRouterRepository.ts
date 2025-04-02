import type { ElysiaWS } from "elysia/ws";
import type { StaticWalletTokenDto } from "../../auth/models/WalletSessionDto";
import type {
    WsPingRequest,
    WsPongRequest,
    WsRequestDirectMessage,
    WsWebAuthnRequest,
    WsWebAuthnResponseRequest,
} from "../dto/WeboscketDirectMessage";
import { PairingRepository } from "./PairingRepository";

export class PairingRouterRepository extends PairingRepository {
    /**
     * Handle a websocket message
     */
    async handleMessage({
        message,
        ws,
        wallet,
    }: {
        message: unknown;
        ws: ElysiaWS;
        wallet: StaticWalletTokenDto;
    }) {
        // Ensure message is an object
        if (typeof message !== "object" || message === null) {
            ws.close(4403, "Invalid message");
            return;
        }

        // Ensure message has a type property
        if (!("type" in message)) {
            ws.close(4403, "Invalid message");
            return;
        }

        const mapped = message as WsRequestDirectMessage;

        // Handle the message
        switch (mapped.type) {
            case "ping":
                await this.handlePingRequest({ message: mapped, ws, wallet });
                break;
            case "pong":
                await this.handlePongRequest({ message: mapped, ws });
                break;
            case "webauthn-request":
                await this.handleWebAuthnRequest({
                    message: mapped,
                    ws,
                    wallet,
                });
                break;
            case "webauthn-response":
                await this.handleWebAuthnResponseRequest({
                    message: mapped,
                    ws,
                });
                break;
            default:
                throw new Error("Invalid message");
        }
    }

    /**
     * Handle a ping request
     */
    private async handlePingRequest({
        ws,
        wallet,
    }: {
        message: WsPingRequest;
        ws: ElysiaWS;
        wallet: StaticWalletTokenDto;
    }) {
        if (wallet.type !== "distant-webauthn") {
            ws.close(
                4403,
                "Can't handle ping request from non-distant-webauthn wallet"
            );
            return;
        }

        // Transmit the ping request to the right topic
        this.sendTopicMessage({
            ws,
            pairingId: wallet.pairingId,
            message: {
                type: "ping",
            },
        });
    }

    private async handleWebAuthnRequest({
        message,
        ws,
        wallet,
    }: {
        message: WsWebAuthnRequest;
        ws: ElysiaWS;
        wallet: StaticWalletTokenDto;
    }) {
        if (wallet.type !== "distant-webauthn") {
            ws.close(
                4403,
                "Can't handle ping request from non-distant-webauthn wallet"
            );
            return;
        }

        this.sendTopicMessage({
            ws,
            pairingId: wallet.pairingId,
            message: {
                type: "webauthn-request",
                payload: {
                    request: message.payload.request,
                },
            },
        });
    }

    /**
     * Handle a pong request
     */
    private async handlePongRequest({
        message,
        ws,
    }: {
        message: WsPongRequest;
        ws: ElysiaWS;
    }) {
        // Assert we got everything we need
        if (!message.payload?.pairingId) {
            ws.close(4403, "Invalid message");
            return;
        }

        // Transmit the pong request to the right topic
        this.sendTopicMessage({
            ws,
            pairingId: message.payload.pairingId,
            message: {
                type: "pong",
            },
        });
    }

    /**
     * Handle a webauthn response request
     */
    private async handleWebAuthnResponseRequest({
        message,
        ws,
    }: {
        message: WsWebAuthnResponseRequest;
        ws: ElysiaWS;
    }) {
        // Assert we got everything we need
        if (!message.payload?.pairingId || !message.payload?.response) {
            ws.close(4403, "Invalid message");
            return;
        }

        // Transmit the webauthn response request to the right topic
        this.sendTopicMessage({
            ws,
            pairingId: message.payload.pairingId,
            message: {
                type: "webauthn-response",
                payload: {
                    response: message.payload.response,
                },
            },
        });
    }
}
