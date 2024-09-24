import cron, { Patterns } from "@elysiajs/cron";
import { Mutex } from "async-mutex";
import { eq, inArray, isNull } from "drizzle-orm";
import { type Hex, encodePacked } from "viem";
import type { BusinessDb } from "../../context";
import { productOracleTable, purchaseStatusTable } from "../../db/schema";
import type { BusinessOracleContextApp } from "../context";
import type { MerkleTreeRepository } from "../repositories/MerkleTreeRepository";

export function updateMerkleRootJob(app: BusinessOracleContextApp) {
    const merkleeRootUpdateMutex = new Mutex();

    return app.use(
        cron({
            name: "updateMerkleRoot",
            pattern: Patterns.everyMinutes(2),
            run: async () => {
                merkleeRootUpdateMutex.runExclusive(async () => {
                    // Update the empty leafs
                    const updatedOracleIds = await updateEmptyLeafs({
                        businessDb: app.decorator.businessDb,
                    });
                    if (updatedOracleIds.size === 0) {
                        console.log("No oracle to update");
                        return;
                    }

                    // Invalidate the merkle tree
                    const productIds = await invalidateOracleTree({
                        oracleIds: updatedOracleIds,
                        businessDb: app.decorator.businessDb,
                        merkleRepository: app.decorator.merkleRepository,
                    });

                    // Then update each products merkle root
                    await updateProductsMerkleRoot({
                        productIds: productIds,
                        businessDb: app.decorator.businessDb,
                        merkleRepository: app.decorator.merkleRepository,
                    });

                    // todo: Should also push them on-chain
                });
            },
        })
    );
}

export type UpdateMerkleRootAppJob = ReturnType<typeof updateMerkleRootJob>;

/**
 * Update all the empty leafs if needed
 */
async function updateEmptyLeafs({
    businessDb,
}: { businessDb: BusinessDb }): Promise<Set<number>> {
    // Get all purchase with empty leafs
    const purchases = await businessDb.query.purchaseStatusTable.findMany({
        where: isNull(purchaseStatusTable.leaf),
    });

    // Set of oracle ids updated
    const oracleIds = new Set<number>();

    // Map each purchase with no leaf to purchase with leaf + id
    const purchaseWithLeafs = purchases.map((purchase) => {
        // Append the product id to our set
        oracleIds.add(purchase.oracleId);

        // Get the blockchain status
        let blockchainStatus: number;
        switch (purchase.status) {
            case "confirmed":
                blockchainStatus = 1;
                break;
            case "cancelled":
                blockchainStatus = 2;
                break;
            case "refunded":
                blockchainStatus = 3;
                break;
            default:
                blockchainStatus = 0;
                break;
        }

        // Compute the leaf
        const leaf = encodePacked(
            ["uint256", "uint8"],
            [BigInt(purchase.purchaseId), blockchainStatus]
        );

        return {
            id: purchase.id,
            leaf,
        };
    });
    console.log(
        `Generated ${purchaseWithLeafs.length} new leafs for ${oracleIds.size} oracles`
    );
    if (purchaseWithLeafs.length === 0) {
        return oracleIds;
    }

    // Execute our leaf updates
    await businessDb.transaction(async (trx) => {
        for (const input of purchaseWithLeafs) {
            await trx
                .update(purchaseStatusTable)
                .set({ leaf: input.leaf })
                .where(eq(purchaseStatusTable.id, input.id));
        }
    });

    // Send back the updated oracle ids
    return oracleIds;
}

/**
 * Invalidate a list of product merklee tree from oracle ids
 */
async function invalidateOracleTree({
    oracleIds,
    businessDb,
    merkleRepository,
}: {
    oracleIds: Set<number>;
    businessDb: BusinessDb;
    merkleRepository: MerkleTreeRepository;
}) {
    // Get the product id from the oracle ids
    const productIdsFromDb = await businessDb
        .select({
            productId: productOracleTable.productId,
        })
        .from(productOracleTable)
        .where(inArray(productOracleTable.id, Array.from(oracleIds)));
    const productIds = productIdsFromDb.map((product) => product.productId);
    console.log(`Invalidate ${productIds.length} product trees`);

    // Invalidate the merkle tree
    merkleRepository.invalidateProductTrees({
        productIds,
    });

    return productIds;
}

/**
 * Update each products merkle root
 */
async function updateProductsMerkleRoot({
    productIds,
    businessDb,
    merkleRepository,
}: {
    productIds: Hex[];
    businessDb: BusinessDb;
    merkleRepository: MerkleTreeRepository;
}) {
    for (const productId of productIds) {
        // Build the merkle root
        const root = await merkleRepository.getMerkleRoot({ productId });
        // Update it in the database
        await businessDb
            .update(productOracleTable)
            .set({ merkleRoot: root })
            .where(eq(productOracleTable.productId, productId));
        console.log(`Updated merkle root for product ${productId}`);
    }
}
