import { eq } from "drizzle-orm";
import { Elysia, error } from "elysia";
import { type Hex, isAddressEqual } from "viem";
import { walletSessionContext } from "../../../common";
import { pairingContext } from "../context";
import { pairingTable } from "../db/schema";

export const managementRoutes = new Elysia()
    .use(pairingContext)
    .use(walletSessionContext)
    .get("/list", async ({ pairingDb, walletSession }) => {
        if (!walletSession) {
            return error(401, "Unauthorized");
        }

        const pairings = await pairingDb.query.pairingTable.findMany({
            where: eq(pairingTable.wallet, walletSession.address),
        });

        return pairings.map((pairing) => ({
            pairingId: pairing.pairingId,
            wallet: pairing.wallet,
            originName: pairing.originName,
            targetName: pairing.targetName,
            lastActiveAt: pairing.lastActiveAt,
        }));
    })
    .delete("/:id", async ({ pairingDb, walletSession, params: { id } }) => {
        if (!walletSession) {
            return error(401, "Unauthorized");
        }

        // Get the pairing
        const pairing = await pairingDb.query.pairingTable.findFirst({
            where: eq(pairingTable.pairingId, id as Hex),
        });
        if (!pairing) {
            return error(404, "Pairing not found");
        }

        if (!pairing.wallet) {
            return error(404, "Pairing not yet resolved");
        }

        // Check if the wallet is the owner of the pairing
        if (!isAddressEqual(pairing.wallet, walletSession.address)) {
            return error(403, "Forbidden");
        }

        // Delete the pairing
        await pairingDb
            .delete(pairingTable)
            .where(eq(pairingTable.pairingId, id as Hex));
    });
// todo: cron job that cleanup every pairing not associated to a wallet within 15min, or pairing inactive for more than 7 days
