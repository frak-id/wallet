import {
    createRateLimitStore,
    getClientIp,
    JwtContext,
    log,
} from "@backend-infrastructure";
import { Elysia } from "elysia";
import type { StaticWalletTokenDto } from "../../../../domain/auth";
import { WsCloseCode } from "../../../../domain/pairing/dto/WebSocketCloseCode";
import { OrchestrationContext } from "../../../../orchestration/context";

const initiateRateLimit = { windowMs: 60_000, maxRequests: 10 };
const initiateStore = createRateLimitStore();
// Resume gets a slightly larger budget than initiate — a flaky network can
// generate several reconnect attempts during a single slow pairing flow.
const resumeRateLimit = { windowMs: 60_000, maxRequests: 20 };
const resumeStore = createRateLimitStore();

/**
 * Resolve the wallet JWT (if any) carried on a WS connection's query string.
 * Returns `undefined` when missing or invalid.
 */
async function parseWallet(
    walletJwt: string | undefined
): Promise<StaticWalletTokenDto | undefined> {
    if (!walletJwt) return undefined;
    const decoded = (await JwtContext.wallet.verify(walletJwt)) as
        | StaticWalletTokenDto
        | false;
    return decoded ? decoded : undefined;
}

export const wsRoute = new Elysia()
    .onStart(({ server }) => {
        // Wire a server-side publisher into the router orchestrator so it
        // can emit `signature-reject` / `merge-completed` autonomously
        // (cleanup cron, post-merge settlement) without needing an
        // `ElysiaWS` sender.
        if (!server) return;
        OrchestrationContext.orchestrators.pairingRouter.setServerPublisher(
            (topic, message) => {
                server.publish(topic, JSON.stringify(message));
            }
        );
    })
    .ws("/ws", {
        open: async (ws) => {
            log.debug(`[Pairing] websocket opened: ${ws.id}`);
            const walletJwt = ws.data.query?.wallet;
            const userAgent = ws.data.headers["user-agent"];
            const action = ws.data.query?.action;

            if (action === "initiate" || action === "resume") {
                const ip =
                    getClientIp({
                        headers: ws.data.headers,
                        remoteAddress: ws.remoteAddress,
                    }) ?? "unknown";
                const store =
                    action === "initiate" ? initiateStore : resumeStore;
                const limit =
                    action === "initiate" ? initiateRateLimit : resumeRateLimit;
                if (!store.consume(ip, limit)) {
                    log.warn({ ip, action }, "[Pairing] Rate limit exceeded");
                    ws.close(WsCloseCode.FORBIDDEN, "Rate limit exceeded");
                    return;
                }
            }

            const wallet = await parseWallet(walletJwt);

            await OrchestrationContext.orchestrators.pairing.handleOpen({
                query: ws.data.query,
                userAgent,
                wallet,
                ws,
            });
        },
        close: async (ws, code, reason) => {
            log.debug(
                `[Pairing] websocket closed: ${ws.id}, code: ${code}, reason: ${reason}`
            );
        },
        message: async (ws, message) => {
            log.debug({ message }, `[Pairing] websocket message from ${ws.id}`);

            const walletJwt = ws.data.query?.wallet;
            const wallet = await parseWallet(walletJwt);

            // Ignore unauthenticated messages — they shouldn't reach this
            // point, but guard anyway.
            if (!wallet) {
                log.debug(`[Pairing] missing wallet token from ${ws.id}`);
                return;
            }

            await OrchestrationContext.orchestrators.pairingRouter.handleMessage(
                {
                    message,
                    ws,
                    wallet,
                }
            );
        },
    });
