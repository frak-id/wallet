import { db, log } from "@backend-infrastructure";
import { and, eq, isNull } from "drizzle-orm";
import type { ElysiaWS } from "elysia/ws";
import type { StaticWalletTokenDto } from "../../auth/models/WalletSessionDto";
import type { NotificationsService } from "../../notifications/services/NotificationsService";
import { pairingSignatureRequestTable, pairingTable } from "../db/schema";
import type { SignatureRejectReason } from "../dto/SignatureRejectReason";
import { WsCloseCode } from "../dto/WebSocketCloseCode";
import type {
    WsPingRequest,
    WsPongRequest,
    WsRequestDirectMessage,
    WsSignatureRejectRequest,
    WsSignatureRequest,
    WsSignatureResponseRequest,
} from "../dto/WebsocketDirectMessage";
import {
    originTopic,
    PairingRepository,
    targetTopic,
} from "./PairingRepository";

/** Server-driven topic publisher that doesn't require an `ElysiaWS` sender. */
type TopicPublisher = (topic: string, message: object) => void;

const SIGNATURE_REQUEST_TTL_MS = 10 * 60 * 1_000;

export class PairingRouterRepository extends PairingRepository {
    /**
     * Topic publisher for server-emitted messages (no `ws` available).
     * Wired by the WS route once Elysia is available; until then, server-side
     * emissions are silently dropped (with a warning).
     */
    private serverPublisher: TopicPublisher | null = null;

    constructor(private readonly notificationsService: NotificationsService) {
        super();
    }

    setServerPublisher(publisher: TopicPublisher): void {
        this.serverPublisher = publisher;
    }

    /* ---------------------------------------------------------------------- */
    /*                          Public surface                                 */
    /* ---------------------------------------------------------------------- */

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
        if (typeof message !== "object" || message === null) {
            ws.close(WsCloseCode.INVALID_MSG, "Invalid message");
            return;
        }
        if (!("type" in message)) {
            ws.close(WsCloseCode.INVALID_MSG, "Invalid message");
            return;
        }

        const mapped = message as WsRequestDirectMessage;

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
                    wallet,
                });
                break;
            default:
                ws.close(WsCloseCode.INVALID_MSG, "Invalid message type");
        }
    }

    /**
     * Server-emit `signature-reject` for a single unprocessed request, then
     * delete the row.
     *
     * Used by the cleanup cron when individual requests expire. No-op (returns
     * `false`) if the row is already processed — plain GC of those rows is
     * handled separately by the cron.
     */
    async cancelSignatureRequest(
        pairingId: string,
        requestId: string,
        reason: SignatureRejectReason
    ): Promise<boolean> {
        const deleted = await db
            .delete(pairingSignatureRequestTable)
            .where(
                and(
                    eq(pairingSignatureRequestTable.pairingId, pairingId),
                    eq(pairingSignatureRequestTable.requestId, requestId),
                    isNull(pairingSignatureRequestTable.processedAt)
                )
            )
            .returning({
                requestId: pairingSignatureRequestTable.requestId,
            });

        if (deleted.length === 0) return false;

        this.publishSignatureReject({
            pairingId,
            requestId,
            reason,
            topics: ["origin", "target"],
        });
        return true;
    }

    /* ---------------------------------------------------------------------- */
    /*                          Origin → Target (origin sender)                */
    /* ---------------------------------------------------------------------- */

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
                "Can't handle signature request from non-distant-webauthn wallet"
            );
            return;
        }

        if (!message.payload.id || !message.payload.request) {
            ws.close(WsCloseCode.INVALID_MSG, "Invalid message");
            return;
        }

        const pairing = await db.query.pairingTable.findFirst({
            where: eq(pairingTable.pairingId, wallet.pairingId),
        });

        if (!pairing) {
            ws.close(WsCloseCode.PAIRING_NOT_FOUND, "Pairing not found");
            return;
        }

        // Idempotent insert: if a request with the same id already exists
        // (because the origin's outbound queue replayed it after a reconnect),
        // do nothing. The origin's tracking Map will be settled by either
        // `signature-response` or `signature-reject` flowing back.
        await db
            .insert(pairingSignatureRequestTable)
            .values({
                pairingId: wallet.pairingId,
                requestId: message.payload.id,
                request: message.payload.request,
                context: message.payload.context,
                expiresAt: new Date(Date.now() + SIGNATURE_REQUEST_TTL_MS),
            })
            .onConflictDoNothing();

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

    /* ---------------------------------------------------------------------- */
    /*                          Target → Origin (target sender)                */
    /* ---------------------------------------------------------------------- */

    private async handlePongRequest({
        message,
        ws,
    }: {
        message: WsPongRequest;
        ws: ElysiaWS;
    }) {
        if (!message.payload?.pairingId) {
            ws.close(WsCloseCode.INVALID_MSG, "Invalid message");
            return;
        }

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

    private async handleSignatureResponseRequest({
        message,
        ws,
    }: {
        message: WsSignatureResponseRequest;
        ws: ElysiaWS;
    }) {
        if (
            !message.payload?.pairingId ||
            !message.payload?.id ||
            !message.payload?.signature
        ) {
            ws.close(WsCloseCode.INVALID_MSG, "Invalid message");
            return;
        }

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

    /* ---------------------------------------------------------------------- */
    /*                          Bidirectional reject                          */
    /* ---------------------------------------------------------------------- */

    /**
     * Handle `signature-reject` from EITHER side:
     *   - target → origin: target user declined the prompt.
     *   - origin → target: origin user closed the dApp modal.
     *
     * In both cases the DB row is deleted and the message is forwarded to
     * the OPPOSITE topic so the peer's UI/promise settles.
     */
    private async handleSignatureRejectRequest({
        message,
        ws,
        wallet,
    }: {
        message: WsSignatureRejectRequest;
        ws: ElysiaWS;
        wallet: StaticWalletTokenDto;
    }) {
        if (!message.payload?.id || !message.payload?.reason?.code) {
            ws.close(WsCloseCode.INVALID_MSG, "Invalid message");
            return;
        }

        // Resolve pairing id: target includes it explicitly, origin (distant-
        // webauthn) carries it on the wallet token.
        const pairingId =
            message.payload.pairingId ??
            (wallet.type === "distant-webauthn" ? wallet.pairingId : undefined);

        if (!pairingId) {
            ws.close(WsCloseCode.INVALID_MSG, "Missing pairing id");
            return;
        }

        await db
            .delete(pairingSignatureRequestTable)
            .where(
                and(
                    eq(
                        pairingSignatureRequestTable.requestId,
                        message.payload.id
                    ),
                    eq(pairingSignatureRequestTable.pairingId, pairingId)
                )
            );

        // Forward to opposite topic. Senders' role is implied by their token:
        //   distant-webauthn → origin → forward to target
        //   webauthn         → target → forward to origin
        const oppositeTopic: "origin" | "target" =
            wallet.type === "distant-webauthn" ? "target" : "origin";

        await this.sendTopicMessage({
            ws,
            pairingId,
            message: {
                type: "signature-reject",
                payload: {
                    pairingId,
                    id: message.payload.id,
                    reason: message.payload.reason,
                },
            },
            topic: oppositeTopic,
        });
    }

    /**
     * Server-emit `signature-reject` to one or both topics. Used by the TTL
     * cleanup cron when individual requests expire.
     */
    private publishSignatureReject({
        pairingId,
        requestId,
        reason,
        topics,
    }: {
        pairingId: string;
        requestId: string;
        reason: SignatureRejectReason;
        topics: readonly ("origin" | "target")[];
    }) {
        if (!this.serverPublisher) {
            log.warn(
                { pairingId, requestId, reason },
                "[Pairing] server publisher not wired \u2014 dropping signature-reject"
            );
            return;
        }

        const payload = {
            type: "signature-reject" as const,
            payload: { pairingId, id: requestId, reason },
        };

        for (const topic of topics) {
            this.serverPublisher(
                topic === "origin"
                    ? originTopic(pairingId)
                    : targetTopic(pairingId),
                payload
            );
        }
    }
}
