import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { ElysiaWS } from "elysia/ws";
import { UAParser } from "ua-parser-js";
import type { StaticWalletTokenDto } from "../../auth/models/WalletSessionDto";
import { pairingTable } from "../db/schema";
import { PairingRepository } from "./PairingRepository";

/**
 * Repository used to manage the pairing database
 * todo: for security consideration we should add a another validation code to the pairing:
 *  - pairing code backend generated
 *  - origin code frontend generated
 *  - target send join event, origin check against his own code, if good, allow the request
 * We will implement that in a 2nd time
 */
export class PairingConnectionRepository extends PairingRepository {
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
        const { action, pairingCode } = query;
        if (!action && !wallet) {
            console.log("No action or wallet token");
            ws.close(4403, "Missing action or wallet token");
            return;
        }

        // If that's an initiate request
        if (action === "initiate" && !wallet) {
            await this.handleInitiateRequest({ userAgent, ws });
            return;
        }

        // If that's a join request
        if (action === "join" && wallet) {
            await this.handleJoinRequest({
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
                wallet,
                ws,
            });
            return;
        }

        // If we got no action and no wallet, we need to close the connection
        ws.close(4403, "Missing action or wallet token");
    }

    /**
     * Handle an initiate pairing request
     */
    private async handleInitiateRequest({
        userAgent,
        ws,
    }: { userAgent?: string; ws: ElysiaWS }) {
        const deviceName = this.uaToDeviceName(userAgent);

        // Create a new pairing
        const pairingId = randomUUID();
        const pairingCode = randomUUID();

        // Insert the pairing into the database
        await this.pairingDb.insert(pairingTable).values({
            pairingId,
            pairingCode,
            originUserAgent: userAgent ?? "Unknown",
            originName: deviceName,
        });

        // Subscribe the client to the pairing topic
        ws.subscribe(`pairing:${pairingId}`);

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
        pairingCode,
        userAgent,
        wallet,
        ws,
    }: {
        pairingCode: string;
        userAgent?: string;
        wallet: StaticWalletTokenDto;
        ws: ElysiaWS;
    }) {
        // Find the right pairing
        const pairing = await this.pairingDb.query.pairingTable.findFirst({
            where: eq(pairingTable.pairingCode, pairingCode),
        });
        if (!pairing) {
            ws.close(4403, "Invalid pairing code");
            return;
        }

        // Check if the pairing is already resolved
        if (pairing.resolvedAt) {
            ws.close(4403, "Pairing already resolved");
            return;
        }

        // Ensure we got a webauthn token
        if (wallet.type !== undefined || wallet.type !== "webauthn") {
            ws.close(4403, "Can't resolve non-webauthn wallet");
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

        // todo: emit the pairing resolved event with the auth token for the origin
        // todo: craft the output msg to send to the one who joined the pairing
    }

    /**
     * Handle reconnection events
     */
    private async handleReconnection({
        wallet,
        ws,
    }: {
        wallet: StaticWalletTokenDto;
        ws: ElysiaWS;
    }) {
        // If we got a distant webauthn token, subscribe the wallet to the pairing topic
        if (wallet.type === "distant-webauthn") {
            ws.subscribe(`pairing:${wallet.pairingId}`);
            await this.sendTopicMessage({
                ws,
                pairingId: wallet.pairingId,
                message: {
                    type: "ping",
                },
            });
            // todo: maybe send an event for the origin to know that the target is back?
            return;
        }

        // If we got a webauthn token, subscribe the wallet to the pairing topic
        if (!wallet.type || wallet.type === "webauthn") {
            const pairings = await this.pairingDb.query.pairingTable.findMany({
                where: eq(pairingTable.wallet, wallet.address),
            });

            // Subscribe the client to every topics related to this pairing
            for (const pairing of pairings) {
                ws.subscribe(`pairing:${pairing.pairingId}`);
                await this.sendTopicMessage({
                    ws,
                    pairingId: pairing.pairingId,
                    message: {
                        type: "pong",
                    },
                });
            }
            return;
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
