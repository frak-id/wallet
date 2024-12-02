import type { AdminWalletsRepository } from "@backend-common/repositories";
import {
    mutexCron,
    purchaseOracle_getMerkleRoot,
    purchaseOracle_updateMerkleRoot,
} from "@backend-utils";
import type { pino } from "@bogeychan/elysia-logger";
import { addresses } from "@frak-labs/app-essentials/blockchain";
import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { type Client, type Hex, type LocalAccount, encodePacked } from "viem";
import {
    readContract,
    simulateContract,
    waitForTransactionReceipt,
    writeContract,
} from "viem/actions";
import type { OracleContextApp, OracleDb } from "../context";
import { productOracleTable, purchaseStatusTable } from "../db/schema";
import type { MerkleTreeRepository } from "../repositories/MerkleTreeRepository";

export const updateMerkleRootJob = (app: OracleContextApp) =>
    app.use(
        mutexCron({
            name: "updateMerkleRoot",
            pattern: "0 */5 * * * *", // Every 5 minutes
            skipIfLocked: true,
            run: async ({ context: { logger } }) => {
                const {
                    oracleDb,
                    merkleRepository,
                    adminWalletsRepository,
                    client,
                    emitter,
                } = app.decorator;

                // Get some unsynced products
                const notSyncedProductIds = await oracleDb
                    .select({
                        productId: productOracleTable.productId,
                    })
                    .from(productOracleTable)
                    .where(
                        and(
                            eq(productOracleTable.synced, false),
                            isNotNull(productOracleTable.merkleRoot)
                        )
                    );
                logger.debug(
                    `${notSyncedProductIds.length} products are not synced`
                );

                // Update the empty leafs
                const updatedOracleIds = await updateEmptyLeafs({
                    oracleDb,
                    logger,
                });
                if (
                    updatedOracleIds.size === 0 &&
                    notSyncedProductIds.length === 0
                ) {
                    logger.debug("No oracle to update");
                    return;
                }

                // Invalidate the merkle tree
                const productIds = await invalidateOracleTree({
                    oracleIds: updatedOracleIds,
                    oracleDb,
                    merkleRepository,
                    logger,
                });
                logger.debug(
                    `Invalidating oracle for ${productIds.length} products`
                );

                const finalProductIds = new Set(
                    productIds.concat(
                        notSyncedProductIds.map((product) => product.productId)
                    )
                );
                logger.debug(
                    `Will update ${finalProductIds.size} products merkle tree`
                );
                // Then update each product ids merkle root
                await updateProductsMerkleRoot({
                    productIds: [...finalProductIds],
                    oracleDb,
                    merkleRepository,
                    adminRepository: adminWalletsRepository,
                    client,
                    logger,
                });

                // Then emit the oracle updated event
                emitter.emit("oracleUpdated");
            },
        })
    );

/**
 * Update all the empty leafs if needed
 */
async function updateEmptyLeafs({
    oracleDb,
    logger,
}: { oracleDb: OracleDb; logger: pino.Logger }): Promise<Set<number>> {
    // Get all purchase with empty leafs
    const purchases = await oracleDb.query.purchaseStatusTable.findMany({
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
    logger.debug(
        `Generated ${purchaseWithLeafs.length} new leafs for ${oracleIds.size} oracles`
    );
    if (purchaseWithLeafs.length === 0) {
        return oracleIds;
    }

    // Execute our leaf updates
    await oracleDb.transaction(async (trx) => {
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
    oracleDb,
    merkleRepository,
    logger,
}: {
    oracleIds: Set<number>;
    oracleDb: OracleDb;
    merkleRepository: MerkleTreeRepository;
    logger: pino.Logger;
}) {
    if (oracleIds.size === 0) {
        return [];
    }
    // Get the product id from the oracle ids
    const productIdsFromDb = await oracleDb
        .select({
            productId: productOracleTable.productId,
        })
        .from(productOracleTable)
        .where(inArray(productOracleTable.id, Array.from(oracleIds)));
    const productIds = productIdsFromDb.map((product) => product.productId);
    logger.debug(`Invalidate ${productIds.length} product trees`);

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
    oracleDb,
    merkleRepository,
    adminRepository,
    client,
    logger,
}: {
    productIds: Hex[];
    oracleDb: OracleDb;
    merkleRepository: MerkleTreeRepository;
    adminRepository: AdminWalletsRepository;
    client: Client;
    logger: pino.Logger;
}) {
    const oracleUpdater = await adminRepository.getKeySpecificAccount({
        key: "oracle-updater",
    });

    for (const productId of productIds) {
        // Build the merkle root
        const root = await merkleRepository.getMerkleRoot({ productId });
        // Update it in the database (and tell it's not synced yet)
        await oracleDb
            .update(productOracleTable)
            .set({ merkleRoot: root, synced: false })
            .where(eq(productOracleTable.productId, productId));
        logger.debug(`Updated merkle root for product ${productId}`);

        // Blockchain update
        const { isSuccess, txHash } = await safeMerkleeRootBlockchainUpdate({
            productId,
            merkleRoot: root,
            oracleUpdater,
            client,
            logger,
        });

        // Update the synced status if it's a success
        if (isSuccess) {
            await oracleDb
                .update(productOracleTable)
                .set(
                    txHash
                        ? { synced: true, lastSyncTxHash: txHash }
                        : { synced: true }
                )
                .where(eq(productOracleTable.productId, productId));
        }
    }
}

/**
 * Perform a blockchain update of the merkle root
 * @returns
 */
async function safeMerkleeRootBlockchainUpdate({
    productId,
    merkleRoot,
    oracleUpdater,
    client,
    logger,
}: {
    productId: Hex;
    merkleRoot: Hex;
    oracleUpdater: LocalAccount;
    client: Client;
    logger: pino.Logger;
}) {
    // Get the current merklee root (and early exit if it's the same)
    const currentRoot = await readContract(client, {
        abi: [purchaseOracle_getMerkleRoot],
        address: addresses.purchaseOracle,
        functionName: "getMerkleRoot",
        args: [BigInt(productId)],
    });

    if (currentRoot === merkleRoot) {
        logger.debug(
            `Merkle root for product ${productId} is already up to date`
        );
        return { isSuccess: true };
    }

    try {
        // Simulate the tx first
        const { request } = await simulateContract(client, {
            account: oracleUpdater,
            abi: [purchaseOracle_updateMerkleRoot],
            address: addresses.purchaseOracle,
            functionName: "updateMerkleRoot",
            args: [BigInt(productId), merkleRoot],
        });

        // Call the update function
        const txHash = await writeContract(client, request);

        // Wait for the tx to be mined
        await waitForTransactionReceipt(client, {
            hash: txHash,
            confirmations: 4,
            retryCount: 8,
        });
        logger.info({ productId }, "Merkle update finalised");
        return { isSuccess: true, txHash };
    } catch (e) {
        logger.error(
            { error: e },
            `Failed to update the merkle root on chain for ${productId}`
        );
        return { isSuccess: false };
    }
}
