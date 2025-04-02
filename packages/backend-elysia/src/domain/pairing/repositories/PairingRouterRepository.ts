import { and, eq } from "drizzle-orm";
import type { ElysiaWS } from "elysia/ws";
import type { StaticWalletTokenDto } from "../../auth/models/WalletSessionDto";
import { webAuthnRequestTable } from "../db/schema";
import type {
    WsPingRequest,
    WsPongRequest,
    WsRequestDirectMessage,
    WsWebAuthnRequest,
    WsWebAuthnResponseRequest,
} from "../dto/WebsocketDirectMessage";
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
        await this.sendTopicMessage({
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

        if (!message.payload.id || !message.payload.request) {
            ws.close(4403, "Invalid message");
            return;
        }

        // Save the webauthn request
        await this.pairingDb.insert(webAuthnRequestTable).values({
            pairingId: wallet.pairingId,
            requestId: message.payload.id,
            request: message.payload.request,
            context: message.payload.context,
        });

        // Transmit the webauthn request to the right topic
        await this.sendTopicMessage({
            ws,
            pairingId: wallet.pairingId,
            message: {
                type: "webauthn-request",
                payload: {
                    id: message.payload.id,
                    request: message.payload.request,
                    context: message.payload.context,
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
        await this.sendTopicMessage({
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
        if (
            !message.payload?.pairingId ||
            !message.payload?.id ||
            !message.payload?.response
        ) {
            ws.close(4403, "Invalid message");
            return;
        }

        // Mark the webauthn request as processed
        await this.pairingDb
            .update(webAuthnRequestTable)
            .set({
                processedAt: new Date(),
                response: message.payload.response,
            })
            .where(
                and(
                    eq(webAuthnRequestTable.requestId, message.payload.id),
                    eq(
                        webAuthnRequestTable.pairingId,
                        message.payload.pairingId
                    )
                )
            );

        // Transmit the webauthn response request to the right topic
        await this.sendTopicMessage({
            ws,
            pairingId: message.payload.pairingId,
            message: {
                type: "webauthn-response",
                payload: {
                    id: message.payload.id,
                    response: message.payload.response,
                },
            },
        });
    }
}
