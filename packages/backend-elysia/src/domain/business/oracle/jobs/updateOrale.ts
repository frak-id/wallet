import { log } from "@backend-common";
import type { AdminWalletsRepository } from "@backend-common/repositories";
import cron, { Patterns } from "@elysiajs/cron";
import {
    addresses,
    purchaseOracleAbi,
} from "@frak-labs/app-essentials/blockchain";
import { Mutex } from "async-mutex";
import { eq, inArray, isNull } from "drizzle-orm";
import { type Client, type Hex, type LocalAccount, encodePacked } from "viem";
import {
    readContract,
    simulateContract,
    waitForTransactionReceipt,
    writeContract,
} from "viem/actions";
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
            run: () =>
                merkleeRootUpdateMutex.runExclusive(async () => {
                    // Extract some stuff from the app
                    const {
                        businessDb,
                        merkleRepository,
                        adminWalletsRepository,
                        client,
                    } = app.decorator;

                    // Update the empty leafs
                    const updatedOracleIds = await updateEmptyLeafs({
                        businessDb,
                    });
                    if (updatedOracleIds.size === 0) {
                        log.debug("No oracle to update");
                        return;
                    }

                    // Invalidate the merkle tree
                    const productIds = await invalidateOracleTree({
                        oracleIds: updatedOracleIds,
                        businessDb,
                        merkleRepository,
                    });
                    log.debug(
                        `Invalidating oracle for ${productIds.length} products`
                    );

                    // Then update each products merkle root
                    await updateProductsMerkleRoot({
                        productIds: productIds,
                        businessDb,
                        merkleRepository,
                        adminRepository: adminWalletsRepository,
                        client,
                    });
                }),
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
    log.debug(
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
    log.debug(`Invalidate ${productIds.length} product trees`);

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
    adminRepository,
    client,
}: {
    productIds: Hex[];
    businessDb: BusinessDb;
    merkleRepository: MerkleTreeRepository;
    adminRepository: AdminWalletsRepository;
    client: Client;
}) {
    const oracleUpdater = await adminRepository.getKeySpecificAccount({
        key: "oracle-updater",
    });

    for (const productId of productIds) {
        // Build the merkle root
        const root = await merkleRepository.getMerkleRoot({ productId });
        // Update it in the database
        await businessDb
            .update(productOracleTable)
            .set({ merkleRoot: root })
            .where(eq(productOracleTable.productId, productId));
        log.debug(`Updated merkle root for product ${productId}`);

        // Blockchain update
        await safeMerkleeRootBlockchainUpdate({
            productId,
            merkleRoot: root,
            oracleUpdater,
            client,
        });
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
}: {
    productId: Hex;
    merkleRoot: Hex;
    oracleUpdater: LocalAccount;
    client: Client;
}) {
    // Get the current merklee root (and early exit if it's the same)
    const currentRoot = await readContract(client, {
        abi: purchaseOracleAbi,
        address: addresses.purchaseOracle,
        functionName: "getMerkleRoot",
        args: [BigInt(productId)],
    });

    if (currentRoot === merkleRoot) {
        log.debug(`Merkle root for product ${productId} is already up to date`);
        return;
    }

    try {
        // Simulate the tx first
        const { request } = await simulateContract(client, {
            account: oracleUpdater,
            abi: purchaseOracleAbi,
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
        log.info({ productId }, "Merkle update finalised");
    } catch (e) {
        log.error(
            { error: e },
            `Failed to update the merkle root on chain for ${productId}`
        );
    }
}
