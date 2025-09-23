import { db, sessionContext } from "@backend-common";
import { t } from "@backend-utils";
import { eq } from "drizzle-orm";
import { Elysia, status } from "elysia";
import { isAddressEqual } from "viem";
import { pairingTable } from "../../../../domain/pairing";

export const managementRoutes = new Elysia()
    .use(sessionContext)
    // Get a pairing by id
    .get(
        "/find/:id",
        async ({ params: { id } }) => {
            const pairing = await db.query.pairingTable.findFirst({
                where: eq(pairingTable.pairingId, id),
            });

            if (!pairing) {
                return status(404, "Pairing not found");
            }

            return {
                id: pairing.pairingId,
                originName: pairing.originName,
                createdAt: pairing.createdAt,
                pairingCode: pairing.pairingCode,
            };
        },
        {
            response: {
                200: t.Object({
                    id: t.String(),
                    originName: t.String(),
                    createdAt: t.Date(),
                    pairingCode: t.String(),
                }),
                404: t.String(),
            },
        }
    )
    // Get all pairings for a wallet
    .get(
        "/list",
        async ({ walletSession }) => {
            const pairings = await db.query.pairingTable.findMany({
                where: eq(pairingTable.wallet, walletSession.address),
            });

            return pairings.map((pairing) => ({
                pairingId: pairing.pairingId,
                originName: pairing.originName,
                targetName: pairing.targetName ?? "Unknown",
                createdAt: pairing.createdAt,
                lastActiveAt: pairing.lastActiveAt,
            }));
        },
        {
            withWalletAuthent: true,
            response: {
                200: t.Array(
                    t.Object({
                        pairingId: t.String(),
                        originName: t.String(),
                        targetName: t.String(),
                        createdAt: t.Date(),
                        lastActiveAt: t.Date(),
                    })
                ),
                401: t.String(),
            },
        }
    )
    // Delete a pairing by id
    .post(
        "/:id/delete",
        async ({ walletSession, params: { id } }) => {
            // Get the pairing
            const pairing = await db.query.pairingTable.findFirst({
                where: eq(pairingTable.pairingId, id),
            });
            if (!pairing) {
                return status(404, "Pairing not found");
            }

            if (!pairing.wallet) {
                return status(404, "Pairing not yet resolved");
            }

            // Check if the wallet is the owner of the pairing
            if (!isAddressEqual(pairing.wallet, walletSession.address)) {
                return status(403, "Forbidden");
            }

            // Delete the pairing
            await db.delete(pairingTable).where(eq(pairingTable.pairingId, id));
        },
        {
            withWalletAuthent: true,
        }
    );
