import { randomUUID } from "node:crypto";
import { and, eq, inArray, isNull } from "drizzle-orm";
import type { ElysiaWS } from "elysia/ws";
import { UAParser } from "ua-parser-js";
import type { Address, Hex } from "viem";
import { log } from "../../../common";
import type { JwtService } from "../../../utils/elysia/jwt";
import type {
    StaticWalletTokenDto,
    StaticWalletWebauthnTokenDto,
    WalletTokenDto,
} from "../../auth/models/WalletSessionDto";
import type { SsoService } from "../../auth/services/WalletSsoService";
import type { PairingDb } from "../context";
import { pairingSignatureRequestTable, pairingTable } from "../db/schema";
import { WsCloseCode } from "../dto/WebSocketCloseCode";
import {
    PairingRepository,
    originTopic,
    targetTopic,
} from "./PairingRepository";

/**
 * Repository used to manage the pairing database
 * todo: for security consideration we should add a another validation code to the pairing:
 *  - pairing code backend generated
 *  - origin code frontend generated
 *  - target send join event, origin check against his own code, if good, allow the request
 * We will implement that in a 2nd time
 */
export class PairingConnectionRepository extends PairingRepository {
    constructor(
        pairingDb: PairingDb,
        // Helpers to generate the auth tokens
        private readonly walletJwtService: JwtService<typeof WalletTokenDto>,
        private readonly ssoService: SsoService,
        private readonly generateSdkJwt: ({
            wallet,
        }: { wallet: Address }) => Promise<{ token: string; expires: number }>
    ) {
        super(pairingDb);
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
        const { action, pairingCode, ssoId, id } = query;
        if (!action && !wallet) {
            log.debug("No action or wallet token");
            ws.close(
                WsCloseCode.UNAUTHORIZED,
                "Missing action or wallet token"
            );
            return;
        }

        // If that's an initiate request
        if (action === "initiate" && !wallet) {
            await this.handleInitiateRequest({ userAgent, ws, ssoId });
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

    /**
     * Handle an initiate pairing request
     */
    private async handleInitiateRequest({
        userAgent,
        ws,
        ssoId: rawSsoId,
    }: { userAgent?: string; ws: ElysiaWS; ssoId?: string }) {
        const deviceName = this.uaToDeviceName(userAgent);

        // Create a new pairing
        const pairingId = randomUUID();

        // Pairing code ia a 6 digit, pin code like, number
        const pairingCode = Math.floor(
            100000 + Math.random() * 900000
        ).toString();

        // Parse the sso id (non blocking, if not provided, we will resolve it later)
        const ssoId = rawSsoId?.startsWith("0x") ? rawSsoId : undefined;

        // Insert the pairing into the database
        await this.pairingDb.insert(pairingTable).values({
            pairingId,
            pairingCode,
            originUserAgent: userAgent ?? "Unknown",
            originName: deviceName,
            ssoId: ssoId as Hex | undefined,
        });
        // Subscribe the client to the pairing topic
        ws.subscribe(originTopic(pairingId));

        // Send back the pairing initiated event to the client
        this.sendDirectMessage({
            ws,
            message: {
                type: "pairing-initiated",
                payload: {
                    pairingId,
                    pairingCode,
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
        const pairing = await this.pairingDb.query.pairingTable.findFirst({
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
        await this.pairingDb
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
            this.walletJwtService.sign(walletPayload),
            this.generateSdkJwt({ wallet: wallet.address }),
        ]);

        // If we got a sso id, resolve the sso session
        if (pairing.ssoId) {
            await this.ssoService.resolveSession({
                id: pairing.ssoId,
                wallet: wallet.address,
                authenticatorId: wallet.authenticatorId,
                pairingId: pairing.pairingId,
            });
        }

        // Send the authenticated message to the origin
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
            // We can skip the update since we will send the partner connect msg just after
            skipUpdate: true,
        });
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
        const pairings = await this.pairingDb
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

        // Get all the pending signatures for each pairings
        const pendingSignatures =
            await this.pairingDb.query.pairingSignatureRequestTable.findMany({
                where: and(
                    inArray(pairingSignatureRequestTable.pairingId, pairingIds),
                    isNull(pairingSignatureRequestTable.processedAt)
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
