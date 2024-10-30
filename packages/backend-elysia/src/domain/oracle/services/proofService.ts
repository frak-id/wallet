import { and, eq } from "drizzle-orm";
import { Elysia } from "elysia";
import { type Hex, isHex } from "viem";
import { type OracleDb, oracleContext } from "../context";
import { productOracleTable, purchaseStatusTable } from "../db/schema";

type PurchaseSelector =
    | {
          productId: Hex;
          purchaseId: string;
      }
    | {
          token: string;
          externalId: string;
      };

export const PurchaseProofService = new Elysia({
    name: "Service.PurchaseProof",
})
    .use(oracleContext)
    .decorate(({ merkleRepository, oracleDb, ...decorators }) => ({
        ...decorators,
        merkleRepository,
        oracleDb,
        // Service methods
        getPurchaseProof: async (selector: PurchaseSelector) => {
            // Get the purchase
            const purchase = await getPurchaseStatus({
                selector,
                oracleDb,
            });
            if (!purchase) {
                return { status: "purchase-not-found" } as const;
            }

            // Case where the purchase hasn't been processed yet
            if (!purchase?.leaf) {
                return { status: "purchase-not-processed" } as const;
            }

            // Then get the oracle for this purchase
            const oracles = await oracleDb
                .select()
                .from(productOracleTable)
                .where(eq(productOracleTable.id, purchase.oracleId))
                .limit(1);
            const oracle = oracles[0];
            if (!oracle) {
                return { status: "purchase-not-found" } as const;
            }

            // Ensure the oracle is synced
            if (!oracle.synced) {
                return { status: "oracle-not-synced" } as const;
            }

            // Otherwise, return the merklee proof for it
            const proof = await merkleRepository.getMerkleProof({
                productId: oracle.productId,
                purchaseLeaf: purchase.leaf,
            });

            if (!proof) {
                return { status: "no-proof-found" } as const;
            }

            return {
                status: "success",
                proof,
                purchase,
                oracle,
            } as const;
        },
    }))
    .as("plugin");

/**
 * Get a purchase status
 */
async function getPurchaseStatus({
    selector,
    oracleDb,
}: { selector: PurchaseSelector; oracleDb: OracleDb }): Promise<
    typeof purchaseStatusTable.$inferSelect | undefined
> {
    let purchases: (typeof purchaseStatusTable.$inferSelect)[];
    if ("token" in selector) {
        // Case when it's a token
        purchases = await oracleDb
            .select()
            .from(purchaseStatusTable)
            .where(
                and(
                    eq(purchaseStatusTable.purchaseToken, selector.token),
                    eq(purchaseStatusTable.externalId, selector.externalId)
                )
            )
            .limit(1);
    } else {
        const { productId, purchaseId } = selector;
        if (isHex(purchaseId)) {
            // Case when it's a pre computed purchase id
            purchases = await oracleDb
                .select()
                .from(purchaseStatusTable)
                .where(eq(purchaseStatusTable.purchaseId, purchaseId))
                .limit(1);
        } else {
            // Case when it's an external purchase id
            const tmp = await oracleDb
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
    }

    // Return the first item
    return purchases[0];
}
