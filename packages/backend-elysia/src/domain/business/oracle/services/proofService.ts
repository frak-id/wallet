import { and, eq } from "drizzle-orm";
import { Elysia } from "elysia";
import { type Hex, isHex } from "viem";
import type { BusinessDb } from "../../context";
import { productOracleTable, purchaseStatusTable } from "../../db/schema";
import { businessOracleContext } from "../context";

export const PurchaseProofService = new Elysia({
    name: "Service.PurchaseProof",
})
    .use(businessOracleContext)
    .decorate(({ merkleRepository, businessDb, ...decorators }) => ({
        ...decorators,
        merkleRepository,
        businessDb,
        // Service methods
        getPurchaseProof: async (productId: Hex, purchaseId: string) => {
            // Get the purchase
            const purchase = await getPurchaseStatus({
                productId,
                purchaseId,
                businessDb,
            });
            if (!purchase) {
                return { status: "purchase-not-found" } as const;
            }

            // Case where the purchase hasn't been processed yet
            if (!purchase?.leaf) {
                return { status: "purchase-not-processed" } as const;
            }

            // Otherwise, return the merklee proof for it
            const proof = await merkleRepository.getMerkleProof({
                productId,
                purchaseLeaf: purchase.leaf,
            });

            if (!proof) {
                return { status: "no-proof-found" } as const;
            }

            return {
                status: "success",
                proof,
                purchase,
            } as const;
        },
    }))
    .as("plugin");

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
