import {
    createRateLimitStore,
    getClientIp,
    JwtContext,
    log,
} from "@backend-infrastructure";
import { Elysia } from "elysia";
import type { StaticWalletTokenDto } from "../../../../../domain/auth";
import { PairingContext } from "../../../../../domain/pairing";
import { WsCloseCode } from "../../../../../domain/pairing/dto/WebSocketCloseCode";

const initiateRateLimit = { windowMs: 60_000, maxRequests: 10 };
const initiateStore = createRateLimitStore();

export const wsRoute = new Elysia().ws("/ws", {
    open: async (ws) => {
        log.debug(`[Pairing] websocket opened: ${ws.id}`);
        const walletJwt = ws.data.query?.wallet;
        const userAgent = ws.data.headers["user-agent"];
        const action = ws.data.query?.action;

        if (action === "initiate") {
            const ip =
                getClientIp({
                    headers: ws.data.headers,
                    remoteAddress: ws.remoteAddress,
                }) ?? "unknown";
            if (!initiateStore.consume(ip, initiateRateLimit)) {
                log.warn({ ip }, "[Pairing] Rate limit exceeded for initiate");
                ws.close(WsCloseCode.FORBIDDEN, "Rate limit exceeded");
                return;
            }
        }

        // Parse the wallet JWT
        let wallet = walletJwt
            ? ((await JwtContext.wallet.verify(walletJwt)) as
                  | StaticWalletTokenDto
                  | false)
            : undefined;
        if (!wallet) {
            wallet = undefined;
        }

        // Handle the pairing open
        await PairingContext.repositories.connection.handlePairingOpen({
            query: ws.data.query,
            userAgent,
            wallet,
            ws,
        });
    },
    // When we close the websocket connection
    close: async (ws, code, reason) => {
        log.debug(
            `[Pairing] websocket closed: ${ws.id}, code: ${code}, reason: ${reason}`
        );
    },
    // When we receive a websocket message
    message: async (ws, message) => {
        log.debug({ message }, `[Pairing] websocket message from ${ws.id}`);

        // Parse the wallet JWT
        const walletJwt = ws.data.query?.wallet;
        const wallet = walletJwt
            ? ((await JwtContext.wallet.verify(walletJwt)) as
                  | StaticWalletTokenDto
                  | false)
            : undefined;

        // If we don't have a wallet, close the connection
        if (!wallet) {
            log.debug(`[Pairing] missing wallet token from ${ws.id}`);
            return;
        }

        // Handle the message
        await PairingContext.repositories.router.handleMessage({
            message,
            ws,
            wallet,
        });
    },
});
