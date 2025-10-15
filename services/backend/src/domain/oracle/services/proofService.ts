import { db } from "@backend-common";
import { and, eq } from "drizzle-orm";
import { type Hex, isHex } from "viem";
import { productOracleTable, purchaseStatusTable } from "../db/schema";
import type { MerkleTreeRepository } from "../repositories/MerkleTreeRepository";

type PurchaseSelector =
    | {
          productId: Hex;
          purchaseId: string;
      }
    | {
          token: string;
          externalId: string;
      };

export class OracleProofService {
    constructor(private readonly merkleRepository: MerkleTreeRepository) {}

    /**
     * Get a purchase proof
     * @param selector - The purchase selector
     * @returns The purchase proof
     */
    async getPurchaseProof(selector: PurchaseSelector) {
        // Get the purchase
        const purchase = await this.getPurchaseStatus({ selector });
        if (!purchase) {
            return { status: "purchase-not-found" } as const;
        }

        // Case where the purchase hasn't been processed yet
        if (!purchase?.leaf) {
            return { status: "purchase-not-processed" } as const;
        }

        // Then get the oracle for this purchase
        const oracles = await db
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
        const proof = await this.merkleRepository.getMerkleProof({
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
    }

    /**
     * Get a purchase status
     */
    async getPurchaseStatus({
        selector,
    }: {
        selector: PurchaseSelector;
    }): Promise<typeof purchaseStatusTable.$inferSelect | undefined> {
        let purchases: (typeof purchaseStatusTable.$inferSelect)[];
        if ("token" in selector) {
            // Case when it's a token
            purchases = await db
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
                purchases = await db
                    .select()
                    .from(purchaseStatusTable)
                    .where(eq(purchaseStatusTable.purchaseId, purchaseId))
                    .limit(1);
            } else {
                // Case when it's an external purchase id
                const tmp = await db
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
}
