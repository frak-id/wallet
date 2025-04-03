import { and, eq } from "drizzle-orm";
import type { ElysiaWS } from "elysia/ws";
import type { StaticWalletTokenDto } from "../../auth/models/WalletSessionDto";
import { pairingSignatureRequestTable } from "../db/schema";
import type {
    WsPingRequest,
    WsPongRequest,
    WsRequestDirectMessage,
    WsSignatureRequest,
    WsSignatureResponseRequest,
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
            case "signature-request":
                await this.handleSignatureRequest({
                    message: mapped,
                    ws,
                    wallet,
                });
                break;
            case "signature-response":
                await this.handleSignatureResponseRequest({
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
                payload: {
                    pairingId: wallet.pairingId,
                },
            },
        });
    }

    private async handleSignatureRequest({
        message,
        ws,
        wallet,
    }: {
        message: WsSignatureRequest;
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

        // Save the request
        await this.pairingDb.insert(pairingSignatureRequestTable).values({
            pairingId: wallet.pairingId,
            requestId: message.payload.id,
            request: message.payload.request,
            context: message.payload.context,
        });

        // Transmit the signature request to the right topic
        await this.sendTopicMessage({
            ws,
            pairingId: wallet.pairingId,
            message: {
                type: "signature-request",
                payload: {
                    pairingId: wallet.pairingId,
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
                payload: {
                    pairingId: message.payload.pairingId,
                },
            },
        });
    }

    /**
     * Handle a webauthn response request
     */
    private async handleSignatureResponseRequest({
        message,
        ws,
    }: {
        message: WsSignatureResponseRequest;
        ws: ElysiaWS;
    }) {
        // Assert we got everything we need
        if (
            !message.payload?.pairingId ||
            !message.payload?.id ||
            !message.payload?.signature
        ) {
            ws.close(4403, "Invalid message");
            return;
        }

        // Mark the webauthn request as processed
        await this.pairingDb
            .update(pairingSignatureRequestTable)
            .set({
                processedAt: new Date(),
                signature: message.payload.signature,
            })
            .where(
                and(
                    eq(
                        pairingSignatureRequestTable.requestId,
                        message.payload.id
                    ),
                    eq(
                        pairingSignatureRequestTable.pairingId,
                        message.payload.pairingId
                    )
                )
            );

        // Transmit the webauthn response request to the right topic
        await this.sendTopicMessage({
            ws,
            pairingId: message.payload.pairingId,
            message: {
                type: "signature-response",
                payload: {
                    pairingId: message.payload.pairingId,
                    id: message.payload.id,
                    signature: message.payload.signature,
                },
            },
        });
    }
}
