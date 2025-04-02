import { Elysia } from "elysia";
import { sessionContext } from "../../../common";
import type { StaticWalletTokenDto } from "../../auth/models/WalletSessionDto";
import { pairingContext } from "../context";

/**
 * The websocket route for pairing
 */
export const wsRoute = new Elysia()
    .use(sessionContext)
    .use(pairingContext)
    .ws("/ws", {
        // When we open a new websocket connection
        open: async (ws) => {
            // Check if we got a wallet session
            const walletJwt = ws.data.headers["x-wallet-auth"];
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
            await ws.data.pairing.connectionRepository.handlePairingOpen({
                query: ws.data.query,
                userAgent,
                wallet,
                ws,
            });
        },
        // When we close a websocket connection
        close: (ws) => {
            // todo: should we emit a message in this topic indicating that the target or origin has leaved? For UI purposes?
            console.log("close");
        },
        // When we receive a websocket message
        message: async (ws, message) => {
            // todo: we assume that the origin will have a distant webauthn token once sending message, need to double check that (like would the header be automaticly updated?)
            // Parse the wallet JWT
            const walletJwt = ws.data.headers["x-wallet-auth"];
            const wallet = walletJwt
                ? ((await ws.data.walletJwt.verify(walletJwt)) as
                      | StaticWalletTokenDto
                      | false)
                : undefined;

            // If we don't have a wallet, close the connection
            if (!wallet) {
                ws.close(4403, "Missing wallet token");
                return;
            }

            // Handle the message
            await ws.data.pairing.routerRepository.handleMessage({
                message,
                ws,
                wallet,
            });
        },
    });
