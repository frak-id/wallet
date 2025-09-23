import { db } from "@backend-common";
import { and, eq } from "drizzle-orm";
import type { ElysiaWS } from "elysia/ws";
import type { StaticWalletTokenDto } from "../../auth/models/WalletSessionDto";
import type { NotificationsService } from "../../notifications/services/NotificationsService";
import { pairingSignatureRequestTable, pairingTable } from "../db/schema";
import { WsCloseCode } from "../dto/WebSocketCloseCode";
import type {
    WsPingRequest,
    WsPongRequest,
    WsRequestDirectMessage,
    WsSignatureRejectRequest,
    WsSignatureRequest,
    WsSignatureResponseRequest,
} from "../dto/WebsocketDirectMessage";
import { PairingRepository } from "./PairingRepository";

export class PairingRouterRepository extends PairingRepository {
    constructor(private readonly notificationsService: NotificationsService) {
        super();
    }

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
            ws.close(WsCloseCode.INVALID_MSG, "Invalid message");
            return;
        }

        // Ensure message has a type property
        if (!("type" in message)) {
            ws.close(WsCloseCode.INVALID_MSG, "Invalid message");
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
            case "signature-reject":
                await this.handleSignatureRejectRequest({
                    message: mapped,
                    ws,
                });
                break;
            default:
                throw new Error("Invalid message");
        }
    }

    /* -------------------------------------------------------------------------- */
    /*                  Origin related msg (responding to target)                 */
    /* -------------------------------------------------------------------------- */

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
                WsCloseCode.FORBIDDEN,
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
            topic: "target",
            // We can skip the update since we are not sure that the target is connected
            skipUpdate: true,
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
                WsCloseCode.FORBIDDEN,
                "Can't handle ping request from non-distant-webauthn wallet"
            );
            return;
        }

        if (!message.payload.id || !message.payload.request) {
            ws.close(WsCloseCode.INVALID_MSG, "Invalid message");
            return;
        }

        // Find the pairing name
        const pairing = await db.query.pairingTable.findFirst({
            where: eq(pairingTable.pairingId, wallet.pairingId),
        });

        if (!pairing) {
            ws.close(WsCloseCode.PAIRING_NOT_FOUND, "Pairing not found");
            return;
        }
        // Save the request
        await db.insert(pairingSignatureRequestTable).values({
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
                    partnerDeviceName: pairing.originName,
                },
            },
            topic: "target",
        });

        // Send a notification to the target
        if (pairing.wallet) {
            await this.notificationsService.sendNotification({
                wallets: [pairing.wallet],
                payload: {
                    title: "Signature request",
                    body: "A biometric signature is requested from your desktop device",
                },
            });
        }
    }

    /* -------------------------------------------------------------------------- */
    /*                 Target received msg (responding to origin)                 */
    /* -------------------------------------------------------------------------- */

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
            ws.close(WsCloseCode.INVALID_MSG, "Invalid message");
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
            topic: "origin",
        });
    }

    /**
     * Handle a signature response request
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
            ws.close(WsCloseCode.INVALID_MSG, "Invalid message");
            return;
        }

        // Mark the signature request as processed
        await db
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

        // Transmit the signature response request to the right topic
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
            topic: "origin",
        });
    }

    /**
     * Handle a signature reject request
     */
    private async handleSignatureRejectRequest({
        message,
        ws,
    }: {
        message: WsSignatureRejectRequest;
        ws: ElysiaWS;
    }) {
        // Assert we got everything we need
        if (
            !message.payload?.pairingId ||
            !message.payload?.id ||
            !message.payload?.reason
        ) {
            ws.close(WsCloseCode.INVALID_MSG, "Invalid message");
            return;
        }

        // Delete the signature
        await db
            .delete(pairingSignatureRequestTable)
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

        // Transmit the signature reject request to the right topic
        await this.sendTopicMessage({
            ws,
            pairingId: message.payload.pairingId,
            message: {
                type: "signature-reject",
                payload: message.payload,
            },
            topic: "origin",
        });
    }
}
