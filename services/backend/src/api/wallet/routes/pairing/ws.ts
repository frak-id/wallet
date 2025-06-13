import { log } from "@backend-common";
import { Elysia } from "elysia";
import type { StaticWalletTokenDto } from "../../../../domain/auth";
import { pairingContext } from "../../../../domain/pairing";

/**
 * The websocket route for pairing
 */
export const wsRoute = new Elysia().use(pairingContext).ws("/ws", {
    // When we open a new websocket connection
    open: async (ws) => {
        log.debug(`[Pairing] websocket opened: ${ws.id}`);
        // Check if we got a wallet session
        const walletJwt = ws.data.query?.wallet;
        const userAgent = ws.data.headers["user-agent"];

        // Parse the wallet JWT
        let wallet = walletJwt
            ? ((await ws.data.walletJwt.verify(walletJwt)) as
                  | StaticWalletTokenDto
                  | false)
            : undefined;
        if (!wallet) {
            wallet = undefined;
        }

        // Handle the pairing open
        await ws.data.pairing.repositories.connection.handlePairingOpen({
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
            ? ((await ws.data.walletJwt.verify(walletJwt)) as
                  | StaticWalletTokenDto
                  | false)
            : undefined;

        // If we don't have a wallet, close the connection
        if (!wallet) {
            log.debug(`[Pairing] missing wallet token from ${ws.id}`);
            return;
        }

        // Handle the message
        await ws.data.pairing.repositories.router.handleMessage({
            message,
            ws,
            wallet,
        });
    },
});
