import { log } from "@backend-infrastructure";
import type { ElysiaWS } from "elysia/ws";
import { type Address, type Hex, isAddressEqual } from "viem";
import type { StaticWalletTokenDto } from "../../domain/auth/models/WalletSessionDto";
import type { MintForCredentialResult } from "../../domain/auth/services/WalletJwtService";
import type { NotificationsService } from "../../domain/notifications/services/NotificationsService";
import type { SignatureRejectReason } from "../../domain/pairing/dto/SignatureRejectReason";
import { WsCloseCode } from "../../domain/pairing/dto/WebSocketCloseCode";
import type {
    WsPingRequest,
    WsPongRequest,
    WsRequestDirectMessage,
    WsSignatureRejectRequest,
    WsSignatureRequest,
    WsSignatureResponseRequest,
} from "../../domain/pairing/dto/WebsocketDirectMessage";
import type {
    WsMergeCompleted,
    WsTopicMessage,
} from "../../domain/pairing/dto/WebsocketTopicMessage";
import type { PairingRepository } from "../../domain/pairing/repositories/PairingRepository";
import type { PairingSignatureRepository } from "../../domain/pairing/repositories/PairingSignatureRepository";
import { originTopic, targetTopic } from "../../domain/pairing/topics";

/** Server-driven topic publisher that doesn't require an `ElysiaWS` sender. */
type TopicPublisher = (topic: string, message: object) => void;

/**
 * Owns the WS-message phase of a pairing (everything after `open`):
 * routes signature flow + ping/pong between origin and target, emits
 * server-driven topic messages (`merge-completed`, expired
 * `signature-reject`), and persists the signature-request lifecycle
 * via `PairingSignatureRepository`.
 *
 * Cross-domain reach (notifications, auth session shapes, merge
 * payloads from the wallet-merge orchestrator) is mediated here so
 * the pairing domain repos stay DB-only.
 */
export class PairingRouterOrchestrator {
    /**
     * Topic publisher for server-emitted messages (no `ws` available).
     * Wired by the WS route once Elysia is available; until then,
     * server-side emissions are silently dropped (with a warning).
     */
    private serverPublisher: TopicPublisher | null = null;

    constructor(
        private readonly pairingRepository: PairingRepository,
        private readonly pairingSignatureRepository: PairingSignatureRepository,
        private readonly notificationsService: NotificationsService
    ) {}

    setServerPublisher(publisher: TopicPublisher): void {
        this.serverPublisher = publisher;
    }

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
     * Server-emit `merge-completed` on both pairing topics after
     * `WalletMergeOrchestrator.settle` succeeds for a cross-device merge.
     *
     *  - Loser-side topic carries a freshly-minted webauthn session so
     *    the loser client can swap its stale session in a single
     *    round-trip.
     *  - Winner-side topic carries the same envelope but with no
     *    `session` — the winner already has the correct session.
     *
     * Owns the pairing-row lookup and the loser-side resolution: the
     * pairing row's `wallet` column was set at join-time to the
     * target's smart-account address, so it's the source of truth for
     * who's on the target side. If the loser address doesn't match
     * either side we log a warning and skip publishing rather than
     * guess — the on-chain + DB merge already committed, so the worst
     * case is the loser device needs a manual reload to pick up its
     * new session.
     */
    async broadcastMergeCompleted({
        pairingId,
        winner,
        loser,
        loserAuthenticatorId,
        loserSession,
    }: {
        pairingId: string;
        winner: Address;
        loser: Address;
        loserAuthenticatorId: string;
        loserSession: MintForCredentialResult;
    }): Promise<void> {
        if (!this.serverPublisher) {
            log.warn(
                { pairingId },
                "[Pairing] server publisher not wired — dropping merge-completed"
            );
            return;
        }

        const pairing = await this.pairingRepository.getByPairingId(pairingId);
        if (!pairing) {
            log.warn(
                { pairingId, winner, loser },
                "[Pairing] cannot broadcast merge-completed: pairing not found"
            );
            return;
        }

        const targetWallet = pairing.wallet;
        if (!targetWallet) {
            log.warn(
                { pairingId },
                "[Pairing] cannot broadcast merge-completed: pairing unresolved"
            );
            return;
        }

        let loserSide: "origin" | "target";
        if (isAddressEqual(targetWallet, loser)) {
            loserSide = "target";
        } else if (isAddressEqual(targetWallet, winner)) {
            loserSide = "origin";
        } else {
            log.warn(
                { pairingId, targetWallet, winner, loser },
                "[Pairing] pairing wallet matches neither winner nor loser; skipping merge-completed"
            );
            return;
        }

        const winnerSide: "origin" | "target" =
            loserSide === "origin" ? "target" : "origin";

        const payload: WsMergeCompleted["payload"] = {
            pairingId,
            winner,
            loser,
            loserAuthenticatorId,
            session: {
                token: loserSession.token,
                sdkJwt: loserSession.sdkJwt,
                wallet: {
                    type: "webauthn",
                    address: loserSession.address,
                    authenticatorId: loserSession.authenticatorId,
                    publicKey: loserSession.publicKey,
                    transports: loserSession.transports,
                },
            },
        };
        const { session: _session, ...winnerPayload } = payload;

        const loserTopicName =
            loserSide === "origin"
                ? originTopic(pairingId)
                : targetTopic(pairingId);
        const winnerTopicName =
            winnerSide === "origin"
                ? originTopic(pairingId)
                : targetTopic(pairingId);

        this.serverPublisher(loserTopicName, {
            type: "merge-completed",
            payload,
        });
        this.serverPublisher(winnerTopicName, {
            type: "merge-completed",
            payload: winnerPayload,
        });
    }

    /**
     * Server-emit `signature-reject` for a single unprocessed request,
     * then delete the row.
     *
     * Used by the cleanup cron when individual requests expire. No-op
     * (returns `false`) if the row is already processed — plain GC of
     * those rows is handled separately by the cron.
     */
    async cancelSignatureRequest(
        pairingId: string,
        requestId: string,
        reason: SignatureRejectReason
    ): Promise<boolean> {
        const wasDeleted =
            await this.pairingSignatureRepository.deleteUnprocessed({
                pairingId,
                requestId,
            });

        if (!wasDeleted) return false;

        this.publishSignatureReject({
            pairingId,
            requestId,
            reason,
            topics: ["origin", "target"],
        });
        return true;
    }

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

        this.sendTopic(
            ws,
            wallet.pairingId,
            {
                type: "ping",
                payload: { pairingId: wallet.pairingId },
            },
            "target",
            // Skip the lastActive update since we are not sure the
            // target is connected.
            { skipLastActiveUpdate: true }
        );
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

        const pairing = await this.pairingRepository.getByPairingId(
            wallet.pairingId
        );

        if (!pairing) {
            ws.close(WsCloseCode.PAIRING_NOT_FOUND, "Pairing not found");
            return;
        }

        await this.pairingSignatureRepository.createIfNotExists({
            pairingId: wallet.pairingId,
            requestId: message.payload.id,
            request: message.payload.request,
            context: message.payload.context,
            kind: message.payload.signatureKind,
        });

        this.sendTopic(
            ws,
            wallet.pairingId,
            {
                type: "signature-request",
                payload: {
                    pairingId: wallet.pairingId,
                    id: message.payload.id,
                    request: message.payload.request,
                    context: message.payload.context,
                    partnerDeviceName: pairing.originName,
                    signatureKind: message.payload.signatureKind,
                },
            },
            "target"
        );

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

        this.sendTopic(
            ws,
            message.payload.pairingId,
            {
                type: "pong",
                payload: { pairingId: message.payload.pairingId },
            },
            "origin"
        );
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

        const isOnchain =
            !message.payload.signatureKind ||
            message.payload.signatureKind === "onchain";
        await this.pairingSignatureRepository.markProcessed({
            pairingId: message.payload.pairingId,
            requestId: message.payload.id,
            signature: isOnchain
                ? (message.payload.signature as Hex)
                : undefined,
        });

        this.sendTopic(
            ws,
            message.payload.pairingId,
            {
                type: "signature-response",
                payload: {
                    pairingId: message.payload.pairingId,
                    id: message.payload.id,
                    signature: message.payload.signature,
                    signatureKind: message.payload.signatureKind,
                },
            },
            "origin"
        );
    }

    /**
     * Handle `signature-reject` from EITHER side:
     *   - target → origin: target user declined the prompt.
     *   - origin → target: origin user closed the dApp modal.
     *
     * In both cases the DB row is deleted and the message is forwarded
     * to the OPPOSITE topic so the peer's UI/promise settles.
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

        // Resolve pairing id: target includes it explicitly, origin
        // (distant-webauthn) carries it on the wallet token.
        const pairingId =
            message.payload.pairingId ??
            (wallet.type === "distant-webauthn" ? wallet.pairingId : undefined);

        if (!pairingId) {
            ws.close(WsCloseCode.INVALID_MSG, "Missing pairing id");
            return;
        }

        await this.pairingSignatureRepository.deleteByRequestId({
            pairingId,
            requestId: message.payload.id,
        });

        // Forward to opposite topic. Senders' role is implied by their
        // token: distant-webauthn → origin → forward to target;
        // webauthn → target → forward to origin.
        const oppositeTopic: "origin" | "target" =
            wallet.type === "distant-webauthn" ? "target" : "origin";

        this.sendTopic(
            ws,
            pairingId,
            {
                type: "signature-reject",
                payload: {
                    pairingId,
                    id: message.payload.id,
                    reason: message.payload.reason,
                },
            },
            oppositeTopic
        );
    }

    /**
     * Server-emit `signature-reject` to one or both topics. Used by
     * the TTL cleanup cron when individual requests expire.
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
                "[Pairing] server publisher not wired — dropping signature-reject"
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

    private sendTopic(
        ws: ElysiaWS,
        pairingId: string,
        message: WsTopicMessage,
        topic: "origin" | "target",
        opts: { skipLastActiveUpdate?: boolean } = {}
    ): void {
        if (!opts.skipLastActiveUpdate) {
            this.pairingRepository.touchLastActiveBatched(pairingId);
        }
        ws.publish(
            topic === "origin"
                ? originTopic(pairingId)
                : targetTopic(pairingId),
            message
        );
    }
}
