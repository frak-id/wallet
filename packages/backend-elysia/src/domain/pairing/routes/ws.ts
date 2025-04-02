import { eq } from "drizzle-orm";
import { Elysia } from "elysia";
import { sessionContext } from "../../../common";
import { pairingContext } from "../context";
import { pairingTable } from "../db/schema";

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

            // if no wallet jwt, probably a origin trying to initiate a pairing, check everything for that use case
            if (!walletJwt) {
                // todo
                return;
            }

            // Get the wallet
            const wallet = await ws.data.walletJwt.verify(walletJwt);
            if (!wallet) {
                return ws.close(4403, "Invalid wallet JWT");
            }

            // If no type or webauthn type, subscribe the wallet to all the pairing topics
            if (!wallet.type || wallet.type === "webauthn") {
                const pairings =
                    await ws.data.pairingDb.query.pairingTable.findMany({
                        where: eq(pairingTable.wallet, wallet.address),
                    });

                // Subscribe the client to every topics related to this pairing
                // todo: probably more logics?
                for (const pairing of pairings) {
                    ws.subscribe(`pairing:${pairing.pairingId}`);
                }
            }

            // If we got a distant webauthn token, subscribe the wallet to the pairing topic
            if (wallet.type === "distant-webauthn") {
                ws.subscribe(`pairing:${wallet.pairingId}`);
            }

            // todo: should we send an acknowledge message or more data upon successful connection?
        },
        // When we close a websocket connection
        close: (ws) => {
            // todo: should we emit a message in this topic indicating that the target or origin has leaved? For UI purposes?
            console.log("close");
        },
        // When we receive a websocket message
        message: (ws, message) => {
            // todo: handle the message depending on the headers + data
            // todo: pairing request should be handled by the open ws method
            // todo: we need to crack how to link this logic with the current auth logic, to provide a JWT token for the origin wallet
            console.log(message);
        },
    });
