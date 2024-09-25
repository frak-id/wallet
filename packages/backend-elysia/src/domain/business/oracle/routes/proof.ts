import { and, eq } from "drizzle-orm";
import Elysia from "elysia";
import { type Hex, isHex } from "viem";
import { t } from "../../../../common";
import type { BusinessDb } from "../../context";
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
            // Get the purchase
            const purchase = await getPurchaseStatus({
                productId,
                purchaseId,
                businessDb,
            });
            if (!purchase) {
                return error(404, "Purchase not found");
            }

            // Case where the purchase hasn't been processed yet
            if (!purchase?.leaf) {
                await (
                    store as UpdateMerkleRootAppJob["store"]
                ).cron.updateMerkleRoot.trigger();
                return error(423, "Purchase not processed yet");
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
                root: await merkleRepository.getMerkleRoot({ productId }),
                proof,
            };
        },
        {
            response: {
                200: t.Object({
                    root: t.Hex(),
                    proof: t.Array(t.Hex()),
                }),
                404: t.String(),
                423: t.String(),
            },
        }
    );

/**
 * Get a purchase status
 */
async function getPurchaseStatus({
    productId,
    purchaseId,
    businessDb,
}: { productId: Hex; purchaseId: string; businessDb: BusinessDb }): Promise<
    typeof purchaseStatusTable.$inferSelect | undefined
> {
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
    // Return the first item
    return purchases[0];
}
