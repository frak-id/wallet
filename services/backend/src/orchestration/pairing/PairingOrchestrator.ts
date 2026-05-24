import { randomInt, randomUUID } from "node:crypto";
import { JwtContext, log } from "@backend-infrastructure";
import { currentChainId } from "@frak-labs/app-essentials/blockchain";
import type { ElysiaWS } from "elysia/ws";
import { UAParser } from "ua-parser-js";
import { isAddressEqual } from "viem";
import type {
    StaticWalletTokenDto,
    StaticWalletWebauthnTokenDto,
} from "../../domain/auth/models/WalletSessionDto";
import type { AuthenticatorRepository } from "../../domain/auth/repositories/AuthenticatorRepository";
import type { WalletSdkSessionService } from "../../domain/auth/services/WalletSdkSessionService";
import type { WalletBindingRepository } from "../../domain/identity/repositories/WalletBindingRepository";
import { WsCloseCode } from "../../domain/pairing/dto/WebSocketCloseCode";
import type { WsDirectMessageResponse } from "../../domain/pairing/dto/WebsocketDirectMessage";
import type { WsTopicMessage } from "../../domain/pairing/dto/WebsocketTopicMessage";
import type { PairingRepository } from "../../domain/pairing/repositories/PairingRepository";
import type { PairingSignatureRepository } from "../../domain/pairing/repositories/PairingSignatureRepository";
import { originTopic, targetTopic } from "../../domain/pairing/topics";
import type { IdentityOrchestrator } from "../identity/IdentityOrchestrator";
import type { IdentityNode } from "../identity/types";

/**
 * Owns the full WebSocket-open lifecycle for a pairing connection:
 * action dispatch (initiate / resume / join / reconnect), cross-domain
 * lookups (authenticator + binding), webauthn JWT mint, identity
 * association, and direct-or-topic message sending.
 *
 * The pairing domain only knows about its own DB rows
 * (`PairingRepository`, `PairingSignatureRepository`). All other
 * dependencies — auth, identity, webauthn binding, identity
 * orchestration — flow through this orchestrator's constructor so
 * there's no cross-domain reach below the orchestration layer.
 */
export class PairingOrchestrator {
    constructor(
        private readonly pairingRepository: PairingRepository,
        private readonly pairingSignatureRepository: PairingSignatureRepository,
        private readonly authenticatorRepository: AuthenticatorRepository,
        private readonly walletBindingRepository: WalletBindingRepository,
        private readonly walletSdkSessionService: WalletSdkSessionService,
        private readonly identityOrchestrator: IdentityOrchestrator
    ) {}

    async handleOpen({
        query,
        userAgent,
        wallet,
        ws,
    }: {
        query: Record<string, string>;
        userAgent?: string;
        wallet?: StaticWalletTokenDto;
        ws: ElysiaWS;
    }) {
        const {
            action,
            pairingCode,
            id,
            originResumeToken,
            originNode: originNodeRaw,
            authenticatorHint,
        } = query;

        if (!action && !wallet) {
            log.debug("No action or wallet token");
            ws.close(
                WsCloseCode.UNAUTHORIZED,
                "Missing action or wallet token"
            );
            return;
        }

        const originNode = this.parseOriginNode(originNodeRaw);

        if (action === "initiate" && !wallet) {
            await this.handleInitiate({
                userAgent,
                ws,
                originNode,
                authenticatorHint,
            });
            return;
        }

        // Resume: origin reconnecting an in-flight pairing before any
        // wallet token exists (e.g. after a transient WS close). The
        // resume token is a self-contained JWT proving the caller is
        // the original origin device, so it's the only credential
        // needed.
        if (action === "resume" && !wallet) {
            await this.handleResume({ originResumeToken, ws });
            return;
        }

        if (action === "join" && wallet) {
            await this.handleJoin({
                id,
                pairingCode,
                userAgent,
                wallet,
                ws,
            });
            return;
        }

        if (wallet) {
            await this.handleReconnection({ userAgent, wallet, ws });
            return;
        }

        ws.close(WsCloseCode.UNAUTHORIZED, "Missing action or wallet token");
    }

    private parseOriginNode(b64?: string): IdentityNode | undefined {
        if (!b64) return undefined;
        try {
            const json = Buffer.from(b64, "base64").toString("utf-8");
            return JSON.parse(json) as IdentityNode;
        } catch {
            log.warn({ b64 }, "Failed to parse originNode");
            return undefined;
        }
    }

    private async handleInitiate({
        userAgent,
        ws,
        originNode,
        authenticatorHint,
    }: {
        userAgent?: string;
        ws: ElysiaWS;
        originNode?: IdentityNode;
        authenticatorHint?: string;
    }) {
        const deviceName = this.uaToDeviceName(userAgent);

        // Hyphenless lowercase 32-char hex (UUID v4 entropy, fewer bytes
        // on the wire so the QR code can use the QR alphanumeric mode
        // when uppercased).
        const pairingId = randomUUID().replace(/-/g, "");
        const pairingCode = randomInt(100000, 1000000).toString();

        await this.pairingRepository.create({
            pairingId,
            pairingCode,
            originUserAgent: userAgent ?? "Unknown",
            originName: deviceName,
            originNode,
            authenticatorHint: authenticatorHint || null,
        });

        ws.subscribe(originTopic(pairingId));

        // Short-lived token that authorises this origin device to call
        // `action=resume`. Delivered ONLY over the direct WS response
        // below (never broadcast on the topic, never returned by the
        // public `/find/:id` endpoint), so possession of `pairingId` +
        // `pairingCode` alone is not sufficient to hijack a resume.
        const originResumeToken = await JwtContext.originResume.sign({
            kind: "origin-resume",
            pairingId,
        });

        this.sendDirect(ws, {
            type: "pairing-initiated",
            payload: {
                pairingId,
                pairingCode,
                originResumeToken,
            },
        });
    }

    /**
     * Handle an origin resume request: re-attach the WS to its pairing
     * topic after a transient close that happened *before* the target
     * authenticated.
     *
     * Authentication uses a self-contained `originResumeToken` JWT that
     * the server issued privately at `pairing-initiated`. The token's
     * signature + `pairingId` claim is the only credential needed — we
     * don't validate `pairingCode` here because the JWT itself is the
     * proof of identity (and `pairingCode` leaks via the public
     * `/find/:id` endpoint anyway).
     *
     * Two outcomes once the token is valid:
     *  - Pairing still unresolved: just re-subscribe to the origin topic
     *    and wait for the target to join. The origin already has the
     *    pairing metadata in its local state, so we don't replay
     *    `pairing-initiated`.
     *  - Pairing resolved while origin was disconnected: re-issue the
     *    wallet JWT against the credential's CURRENT binding (which may
     *    have been repointed by a wallet merge between join and resume)
     *    and replay the `authenticated` message directly to this WS.
     */
    private async handleResume({
        originResumeToken,
        ws,
    }: {
        originResumeToken?: string;
        ws: ElysiaWS;
    }) {
        if (!originResumeToken) {
            ws.close(WsCloseCode.RESUME_TOKEN_EXPIRED, "Missing resume token");
            return;
        }

        const verified =
            await JwtContext.originResume.verify(originResumeToken);
        if (!verified) {
            ws.close(
                WsCloseCode.RESUME_TOKEN_EXPIRED,
                "Invalid or expired resume token"
            );
            return;
        }

        const pairing = await this.pairingRepository.getByPairingId(
            verified.pairingId
        );
        if (!pairing) {
            // Pairing was GC'd before the origin reconnected. Use the
            // same close code so the client treats it as a clean
            // restart trigger.
            ws.close(WsCloseCode.RESUME_TOKEN_EXPIRED, "Pairing not found");
            return;
        }

        ws.subscribe(originTopic(pairing.pairingId));
        await this.pairingRepository.touchLastActiveNow(pairing.pairingId);

        // Pairing not yet resolved — nothing else to do, the origin
        // already has its `pairing` state from the original
        // `pairing-initiated`.
        if (!pairing.wallet) {
            log.debug(
                { pairingId: pairing.pairingId },
                "[Pairing] origin resumed an unresolved pairing"
            );
            return;
        }

        // Pairing was resolved while the origin was disconnected.
        // Replay `authenticated` so the origin can settle into its
        // `paired` session using the exact credential the target
        // joined with (persisted at join time on the pairing row).
        //
        // A wallet merge that happens between join and resume leaves
        // `pairing.wallet` stale — the credential has been repointed
        // at the winner. Rebind the replayed JWT to the credential's
        // CURRENT binding rather than the pairing row's snapshot, so
        // a resumed desktop never holds a session against a
        // merged-away wallet. When no merge happened the active
        // binding matches `pairing.wallet` and the payload is
        // identical to the previous behaviour.
        const authenticator = pairing.authenticatorId
            ? await this.authenticatorRepository.getByCredentialId(
                  pairing.authenticatorId
              )
            : null;
        if (!authenticator) {
            log.warn(
                {
                    pairingId: pairing.pairingId,
                    wallet: pairing.wallet,
                    authenticatorId: pairing.authenticatorId,
                },
                "[Pairing] resume: no authenticator on file for resolved pairing"
            );
            ws.close(
                WsCloseCode.PAIRING_NOT_FOUND,
                "No authenticator for resolved pairing"
            );
            return;
        }

        const activeBinding =
            await this.walletBindingRepository.getActiveBinding({
                credentialId: authenticator._id,
                chainId: currentChainId,
            });
        if (!activeBinding) {
            log.warn(
                {
                    pairingId: pairing.pairingId,
                    wallet: pairing.wallet,
                    authenticatorId: authenticator._id,
                    chainId: currentChainId,
                },
                "[Pairing] resume: no active binding for credential, refusing to mint a stale session"
            );
            ws.close(
                WsCloseCode.PAIRING_NOT_FOUND,
                "No active binding for resumed credential"
            );
            return;
        }

        const walletAddress = activeBinding.smartWalletAddress;
        if (!isAddressEqual(walletAddress, pairing.wallet)) {
            log.info(
                {
                    pairingId: pairing.pairingId,
                    pairingWallet: pairing.wallet,
                    currentWallet: walletAddress,
                    authenticatorId: authenticator._id,
                },
                "[Pairing] resume: credential was repointed (merge) — replaying with current binding"
            );
        }

        const walletPayload: StaticWalletTokenDto = {
            type: "distant-webauthn",
            address: walletAddress,
            authenticatorId: authenticator._id,
            publicKey: authenticator.publicKey,
            transports: undefined,
            pairingId: pairing.pairingId,
        };

        const [walletToken, sdkJwt] = await Promise.all([
            JwtContext.wallet.sign(walletPayload),
            this.walletSdkSessionService.generateSdkJwt({
                wallet: walletAddress,
            }),
        ]);

        log.debug(
            { pairingId: pairing.pairingId, wallet: walletAddress },
            "[Pairing] origin resumed a resolved pairing — replaying authenticated"
        );

        this.sendDirect(ws, {
            type: "authenticated",
            payload: {
                token: walletToken,
                sdkJwt,
                wallet: walletPayload,
            },
        });
    }

    private async handleJoin({
        id,
        pairingCode,
        userAgent,
        wallet,
        ws,
    }: {
        id: string;
        pairingCode: string;
        userAgent?: string;
        wallet: StaticWalletTokenDto;
        ws: ElysiaWS;
    }) {
        const pairing = await this.pairingRepository.getByPairingId(id);
        if (!pairing) {
            ws.close(WsCloseCode.PAIRING_NOT_FOUND, "Pairing not found");
            return;
        }

        if (pairing.pairingCode !== pairingCode) {
            ws.close(WsCloseCode.FORBIDDEN, "Invalid pairing code");
            return;
        }

        if (pairing.resolvedAt) {
            ws.close(WsCloseCode.FORBIDDEN, "Pairing already resolved");
            return;
        }

        if (wallet.type !== undefined && wallet.type !== "webauthn") {
            ws.close(
                WsCloseCode.FORBIDDEN,
                "Can't resolve non-webauthn wallet"
            );
            return;
        }

        // Cross-device merge credential pinning: the origin pre-declared
        // which credential must resolve this pairing; a mobile joining
        // with anything else is rejected so the desktop can never end
        // up tunnelling actions through the wrong wallet.
        if (
            pairing.authenticatorHint &&
            wallet.authenticatorId !== pairing.authenticatorHint
        ) {
            ws.close(WsCloseCode.FORBIDDEN, "Authenticator mismatch");
            return;
        }

        const targetName = this.uaToDeviceName(userAgent);
        await this.pairingRepository.markResolved({
            pairingId: pairing.pairingId,
            wallet: wallet.address,
            authenticatorId: wallet.authenticatorId,
            targetUserAgent: userAgent ?? "Unknown",
            targetName,
        });

        await this.handleReconnection({ userAgent, wallet, ws });

        const walletPayload: StaticWalletTokenDto = {
            type: "distant-webauthn",
            address: wallet.address,
            authenticatorId: wallet.authenticatorId,
            publicKey: wallet.publicKey,
            transports: undefined,
            pairingId: pairing.pairingId,
        };

        const [walletToken, sdkJwt] = await Promise.all([
            JwtContext.wallet.sign(walletPayload),
            this.walletSdkSessionService.generateSdkJwt({
                wallet: wallet.address,
            }),
        ]);

        this.sendTopic(
            ws,
            pairing.pairingId,
            {
                type: "authenticated",
                payload: {
                    token: walletToken,
                    sdkJwt,
                    wallet: walletPayload,
                },
            },
            "origin",
            { skipLastActiveUpdate: true }
        );

        if (pairing.originNode) {
            try {
                await this.identityOrchestrator.resolveAndAssociate([
                    { type: "wallet", value: wallet.address },
                    pairing.originNode,
                ]);
            } catch (err: unknown) {
                log.error(
                    {
                        err,
                        wallet: wallet.address,
                        originNode: pairing.originNode,
                    },
                    "Failed to associate identity after pairing"
                );
            }
        }
    }

    private async handleReconnection({
        userAgent,
        wallet,
        ws,
    }: {
        userAgent?: string;
        wallet: StaticWalletTokenDto;
        ws: ElysiaWS;
    }) {
        if (wallet.type === "distant-webauthn") {
            ws.subscribe(originTopic(wallet.pairingId));
            this.sendTopic(
                ws,
                wallet.pairingId,
                {
                    type: "partner-connected",
                    payload: {
                        pairingId: wallet.pairingId,
                        deviceName: this.uaToDeviceName(userAgent),
                    },
                },
                "target"
            );
            return;
        }

        if (!wallet.type || wallet.type === "webauthn") {
            await this.targetWalletReconnection({ userAgent, wallet, ws });
        }
    }

    private async targetWalletReconnection({
        userAgent,
        wallet,
        ws,
    }: {
        userAgent?: string;
        wallet: StaticWalletWebauthnTokenDto;
        ws: ElysiaWS;
    }) {
        const pairings = await this.pairingRepository.getByWallet(
            wallet.address
        );

        if (pairings.length === 0) {
            ws.close(
                WsCloseCode.NO_CONNECTION_TO_CONNECT_TO,
                "No connection to connect to"
            );
            return;
        }

        const deviceName = this.uaToDeviceName(userAgent);
        const pairingIds = pairings.map((p) => p.pairingId);

        for (const pairingId of pairingIds) {
            ws.subscribe(targetTopic(pairingId));
            this.sendTopic(
                ws,
                pairingId,
                {
                    type: "partner-connected",
                    payload: { pairingId, deviceName },
                },
                "origin"
            );
        }

        const pendingSignatures =
            await this.pairingSignatureRepository.getPendingForPairings(
                pairingIds
            );

        for (const signature of pendingSignatures) {
            this.sendDirect(ws, {
                type: "signature-request",
                payload: {
                    pairingId: signature.pairingId,
                    id: signature.requestId,
                    request: signature.request,
                    context: signature.context as object | undefined,
                    partnerDeviceName:
                        pairings.find(
                            (p) => p.pairingId === signature.pairingId
                        )?.originName ?? "Unknown",
                },
            });
        }
    }

    private uaToDeviceName(userAgent?: string): string {
        if (!userAgent) return "Unknown";
        const parsed = UAParser(userAgent);
        return `${parsed.browser.name} on ${parsed.os.name}`;
    }

    private sendDirect(
        ws: ElysiaWS,
        message: WsDirectMessageResponse | WsTopicMessage
    ): void {
        ws.send(message);
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
