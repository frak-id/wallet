import { randomInt, randomUUID } from "node:crypto";
import { db, JwtContext, log } from "@backend-infrastructure";
import { and, eq, gt, inArray, isNull } from "drizzle-orm";
import type { ElysiaWS } from "elysia/ws";
import { UAParser } from "ua-parser-js";
import { OrchestrationContext } from "../../../orchestration/context";
import type { IdentityNode } from "../../../orchestration/identity/types";
import type {
    StaticWalletTokenDto,
    StaticWalletWebauthnTokenDto,
} from "../../auth/models/WalletSessionDto";
import type { AuthenticatorRepository } from "../../auth/repositories/AuthenticatorRepository";
import type { WalletSdkSessionService } from "../../auth/services/WalletSdkSessionService";
import { pairingSignatureRequestTable, pairingTable } from "../db/schema";
import { WsCloseCode } from "../dto/WebSocketCloseCode";
import {
    originTopic,
    PairingRepository,
    targetTopic,
} from "./PairingRepository";

/**
 * Repository used to manage the pairing database
 */
export class PairingConnectionRepository extends PairingRepository {
    constructor(
        // Helpers to generate the auth tokens
        private readonly walletSdkSession: WalletSdkSessionService,
        private readonly authenticatorRepository: AuthenticatorRepository
    ) {
        super();
    }

    /**
     * Handle a WS connection with no wallet session present
     */
    async handlePairingOpen({
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

        // If that's an initiate request
        if (action === "initiate" && !wallet) {
            await this.handleInitiateRequest({ userAgent, ws, originNode });
            return;
        }

        // If that's a resume request (origin reconnecting an in-flight pairing
        // before any wallet token exists — e.g. after a transient WS close).
        // The resume token is a self-contained JWT that proves the caller is
        // the original origin device, so it's the only credential we need.
        if (action === "resume" && !wallet) {
            await this.handleResumeRequest({
                originResumeToken,
                userAgent,
                ws,
            });
            return;
        }

        // If that's a join request
        if (action === "join" && wallet) {
            await this.handleJoinRequest({
                id,
                pairingCode,
                userAgent,
                wallet,
                ws,
            });
            return;
        }

        // If we got a wallet token, we need to parse the connection query
        if (wallet) {
            await this.handleReconnection({
                userAgent,
                wallet,
                ws,
            });
            return;
        }

        // If we got no action and no wallet, we need to close the connection
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

    private async handleInitiateRequest({
        userAgent,
        ws,
        originNode,
    }: {
        userAgent?: string;
        ws: ElysiaWS;
        originNode?: IdentityNode;
    }) {
        const deviceName = this.uaToDeviceName(userAgent);

        // Create a new pairing
        // Hyphenless lowercase 32-char hex (UUID v4 entropy, fewer bytes on the
        // wire so the QR code can use the QR alphanumeric mode when uppercased).
        const pairingId = randomUUID().replace(/-/g, "");

        const pairingCode = randomInt(100000, 1000000).toString();

        await db.insert(pairingTable).values({
            pairingId,
            pairingCode,
            originUserAgent: userAgent ?? "Unknown",
            originName: deviceName,
            originNode,
        });
        // Subscribe the client to the pairing topic
        ws.subscribe(originTopic(pairingId));

        // Sign a short-lived token that authorises this origin device to call
        // `action=resume`. The token is delivered ONLY over the direct WS
        // response below (never broadcast on the topic, never returned by the
        // public `/find/:id` endpoint), so possession of `pairingId` +
        // `pairingCode` alone is not sufficient to hijack a resume.
        const originResumeToken = await JwtContext.originResume.sign({
            kind: "origin-resume",
            pairingId,
        });

        // Send back the pairing initiated event to the client
        this.sendDirectMessage({
            ws,
            message: {
                type: "pairing-initiated",
                payload: {
                    pairingId,
                    pairingCode,
                    originResumeToken,
                },
            },
        });
    }

    /**
     * Handle an origin resume request: re-attach the WS to its pairing topic
     * after a transient close that happened *before* the target authenticated.
     *
     * Authentication uses a self-contained `originResumeToken` JWT that the
     * server issued privately at `pairing-initiated`. The token's signature
     * + `pairingId` claim is the only credential we need — we don't validate
     * `pairingCode` here because the JWT itself is the proof of identity
     * (and `pairingCode` leaks via the public `/find/:id` endpoint anyway).
     *
     * Two outcomes once the token is valid:
     *  - Pairing still unresolved: just re-subscribe to the origin topic and
     *    wait for the target to join. The origin already has the pairing
     *    metadata in its local state, so we don't replay `pairing-initiated`.
     *  - Pairing resolved while origin was disconnected: re-issue the wallet
     *    JWT (looking up any valid authenticator for the wallet) and replay
     *    the `authenticated` message directly to this WS.
     */
    private async handleResumeRequest({
        originResumeToken,
        userAgent,
        ws,
    }: {
        originResumeToken?: string;
        userAgent?: string;
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

        const pairing = await db.query.pairingTable.findFirst({
            where: eq(pairingTable.pairingId, verified.pairingId),
        });
        if (!pairing) {
            // Pairing was GC'd before the origin reconnected. Use the same
            // close code so the client treats it as a clean restart trigger.
            ws.close(WsCloseCode.RESUME_TOKEN_EXPIRED, "Pairing not found");
            return;
        }

        // Always re-subscribe to the origin topic so future target-side
        // messages reach this WS.
        ws.subscribe(originTopic(pairing.pairingId));

        // Touch lastActiveAt so the cleanup cron treats the resumed pairing
        // as still alive.
        await db
            .update(pairingTable)
            .set({ lastActiveAt: new Date() })
            .where(eq(pairingTable.pairingId, pairing.pairingId));

        // Pairing not yet resolved — nothing else to do, the origin already
        // has its `pairing` state from the original `pairing-initiated`.
        if (!pairing.wallet) {
            log.debug(
                { pairingId: pairing.pairingId },
                "[Pairing] origin resumed an unresolved pairing"
            );
            return;
        }

        // Pairing was resolved while the origin was disconnected. Replay
        // `authenticated` so the origin can settle into its `paired` session.
        const authenticator =
            await this.authenticatorRepository.getBySmartWalletAddress(
                pairing.wallet
            );
        if (!authenticator) {
            log.warn(
                {
                    pairingId: pairing.pairingId,
                    wallet: pairing.wallet,
                },
                "[Pairing] resume: no authenticator found for resolved wallet"
            );
            ws.close(
                WsCloseCode.PAIRING_NOT_FOUND,
                "No authenticator for resolved wallet"
            );
            return;
        }

        const walletPayload: StaticWalletTokenDto = {
            type: "distant-webauthn",
            address: pairing.wallet,
            authenticatorId: authenticator._id,
            publicKey: authenticator.publicKey,
            transports: undefined,
            pairingId: pairing.pairingId,
        };

        const [walletToken, sdkJwt] = await Promise.all([
            JwtContext.wallet.sign(walletPayload),
            this.walletSdkSession.generateSdkJwt({ wallet: pairing.wallet }),
        ]);

        log.debug(
            { pairingId: pairing.pairingId, wallet: pairing.wallet },
            "[Pairing] origin resumed a resolved pairing — replaying authenticated"
        );

        // We intentionally bypass `userAgent` updates here — this is a
        // re-attachment, not a fresh join.
        void userAgent;

        this.sendDirectMessage({
            ws,
            message: {
                type: "authenticated",
                payload: {
                    token: walletToken,
                    sdkJwt,
                    wallet: walletPayload,
                },
            },
        });
    }

    /**
     * Handle a pairing join request
     */
    private async handleJoinRequest({
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
        // Find the right pairing
        const pairing = await db.query.pairingTable.findFirst({
            where: eq(pairingTable.pairingId, id),
        });
        if (!pairing) {
            ws.close(WsCloseCode.PAIRING_NOT_FOUND, "Pairing not found");
            return;
        }
        // Check if the pairing code is valid
        if (pairing.pairingCode !== pairingCode) {
            ws.close(WsCloseCode.FORBIDDEN, "Invalid pairing code");
            return;
        }

        // Check if the pairing is already resolved
        if (pairing.resolvedAt) {
            ws.close(WsCloseCode.FORBIDDEN, "Pairing already resolved");
            return;
        }

        // Ensure we got a webauthn token
        if (wallet.type !== undefined && wallet.type !== "webauthn") {
            ws.close(
                WsCloseCode.FORBIDDEN,
                "Can't resolve non-webauthn wallet"
            );
            return;
        }

        // Update the pairing with the wallet address and everything
        const targetName = this.uaToDeviceName(userAgent);
        await db
            .update(pairingTable)
            .set({
                wallet: wallet.address,
                targetUserAgent: userAgent ?? "Unknown",
                targetName,
                resolvedAt: new Date(),
                lastActiveAt: new Date(),
            })
            .where(eq(pairingTable.pairingId, pairing.pairingId));

        // Connect the target to the topic
        await this.handleReconnection({
            userAgent,
            wallet,
            ws,
        });

        // Build the wallet payload for the origin
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
            this.walletSdkSession.generateSdkJwt({ wallet: wallet.address }),
        ]);

        await this.sendTopicMessage({
            ws,
            pairingId: pairing.pairingId,
            message: {
                type: "authenticated",
                payload: {
                    token: walletToken,
                    sdkJwt: sdkJwt,
                    wallet: walletPayload,
                },
            },
            topic: "origin",
            skipUpdate: true,
        });

        if (pairing.originNode) {
            try {
                await OrchestrationContext.orchestrators.identity.resolveAndAssociate(
                    [
                        { type: "wallet", value: wallet.address },
                        pairing.originNode,
                    ]
                );
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

    /**
     * Handle reconnection events
     */
    private async handleReconnection({
        userAgent,
        wallet,
        ws,
    }: {
        userAgent?: string;
        wallet: StaticWalletTokenDto;
        ws: ElysiaWS;
    }) {
        // If we got a distant webauthn token, subscribe the wallet to the pairing topic
        if (wallet.type === "distant-webauthn") {
            ws.subscribe(originTopic(wallet.pairingId));
            await this.sendTopicMessage({
                ws,
                pairingId: wallet.pairingId,
                message: {
                    type: "partner-connected",
                    payload: {
                        pairingId: wallet.pairingId,
                        deviceName: this.uaToDeviceName(userAgent),
                    },
                },
                // We are the origin, so send this message to the target
                topic: "target",
            });
            return;
        }

        // If we got a webauthn token, subscribe the wallet to the pairing topic
        if (!wallet.type || wallet.type === "webauthn") {
            await this.targetWalletReconnection({
                userAgent,
                wallet,
                ws,
            });
            return;
        }
    }

    /**
     * Handle a target wallet reconnection
     */
    private async targetWalletReconnection({
        userAgent,
        wallet,
        ws,
    }: {
        userAgent?: string;
        wallet: StaticWalletWebauthnTokenDto;
        ws: ElysiaWS;
    }) {
        // Get all the pairing ids
        const pairings = await db
            .select({
                pairingId: pairingTable.pairingId,
                originName: pairingTable.originName,
            })
            .from(pairingTable)
            .where(eq(pairingTable.wallet, wallet.address));

        const pairingIds = pairings.map((p) => p.pairingId);
        const deviceName = this.uaToDeviceName(userAgent);

        // If we got no pairings, we need to close the connection
        if (pairings.length === 0) {
            ws.close(
                WsCloseCode.NO_CONNECTION_TO_CONNECT_TO,
                "No connection to connect to"
            );
            return;
        }

        // Subscribe the client to every topics related to this pairing
        for (const pairing of pairingIds) {
            ws.subscribe(targetTopic(pairing));
            await this.sendTopicMessage({
                ws,
                pairingId: pairing,
                message: {
                    type: "partner-connected",
                    payload: {
                        pairingId: pairing,
                        deviceName,
                    },
                },
                // We are the target, so send this message to the origin
                topic: "origin",
            });
        }

        const pendingSignatures =
            await db.query.pairingSignatureRequestTable.findMany({
                where: and(
                    inArray(pairingSignatureRequestTable.pairingId, pairingIds),
                    isNull(pairingSignatureRequestTable.processedAt),
                    gt(pairingSignatureRequestTable.expiresAt, new Date())
                ),
            });

        // Send all the pending signatures to the client
        for (const signature of pendingSignatures) {
            this.sendDirectMessage({
                ws,
                message: {
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
                },
            });
        }
    }

    /**
     * Map a user agent to a device name
     */
    private uaToDeviceName(userAgent?: string) {
        if (!userAgent) {
            return "Unknown";
        }

        // parse the user agent to get the device name
        const parsed = UAParser(userAgent);
        return `${parsed.browser.name} on ${parsed.os.name}`;
    }
}
