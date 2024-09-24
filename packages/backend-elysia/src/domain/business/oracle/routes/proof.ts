import { and, eq } from "drizzle-orm";
import Elysia from "elysia";
import { isHex } from "viem";
import { t } from "../../../../common";
import { productOracleTable, purchaseStatusTable } from "../../db/schema";
import { businessOracleContext } from "../context";
import type { UpdateMerkleRootAppJob } from "../jobs/updateOrale";

export const proofRoutes = new Elysia({
    prefix: "/proof",
})
    .use(businessOracleContext)
    .guard({
        params: t.Object({
            productId: t.Optional(t.Hex()),
            purchaseId: t.Optional(t.String()),
        }),
    })
    .resolve(({ params: { productId, purchaseId }, error }) => {
        if (!productId) {
            return error(400, "Invalid product id");
        }
        if (!purchaseId) {
            return error(400, "Invalid purchase id");
        }

        return { productId, purchaseId };
    })
    // Get the proof around a given product and purchase
    .get(
        ":productId/purchase/:purchaseId",
        async ({
            productId,
            purchaseId,
            merkleRepository,
            businessDb,
            store,
            error,
        }) => {
            let purchases: (typeof purchaseStatusTable.$inferSelect)[];
            if (isHex(purchaseId)) {
                // Case when it's a pre computed purchase id
                purchases = await businessDb
                    .select()
                    .from(purchaseStatusTable)
                    .where(eq(purchaseStatusTable.purchaseId, purchaseId))
                    .limit(1);
            } else {
                // Case when it's an external purchase id
                const tmp = await businessDb
                    .select()
                    .from(purchaseStatusTable)
                    .innerJoin(
                        productOracleTable,
                        eq(purchaseStatusTable.oracleId, productOracleTable.id)
                    )
                    .where(
                        and(
                            eq(purchaseStatusTable.externalId, purchaseId),
                            eq(productOracleTable.productId, productId)
                        )
                    )
                    .limit(1);
                purchases = tmp.map((p) => p.product_oracle_purchase);
            }
            // Get the purchase
            const purchase = purchases[0];
            // Case where the purchase hasn't been processed yet
            if (!purchase?.leaf) {
                await (
                    store as UpdateMerkleRootAppJob["store"]
                ).cron.updateMerkleRoot.trigger();
                return error(423, `Purchase ${purchaseId} not processed yet`);
            }

            // Otherwise, return the merklee proof for it
            const proof = await merkleRepository.getMerkleProof({
                productId,
                purchaseLeaf: purchase.leaf,
            });
            if (!proof) {
                return error(404, "No proof found");
            }
            return {
                proof,
            };
        },
        {
            response: {
                200: t.Object({
                    proof: t.Array(t.Hex()),
                }),
                404: t.String(),
                423: t.String(),
            },
        }
    );
