import { adminWalletsRepository, log, viemClient } from "@backend-common";
import { addresses } from "@frak-labs/app-essentials";
import { eq, inArray, isNull } from "drizzle-orm";
import { type Hex, type LocalAccount, encodePacked } from "viem";
import {
    readContract,
    simulateContract,
    waitForTransactionReceipt,
    writeContract,
} from "viem/actions";
import {
    purchaseOracle_getMerkleRoot,
    purchaseOracle_updateMerkleRoot,
} from "../../../utils";
import type { OracleDb } from "../context";
import { productOracleTable, purchaseStatusTable } from "../db/schema";
import type { MerkleTreeRepository } from "../repositories/MerkleTreeRepository";

export class UpdateOracleService {
    constructor(
        private readonly oracleDb: OracleDb,
        private readonly merkleRepository: MerkleTreeRepository
    ) {}

    /**
     * Update all the empty leafs if needed
     */
    async updateEmptyLeafs(): Promise<Set<number>> {
        // Get all purchase with empty leafs
        const purchases =
            await this.oracleDb.query.purchaseStatusTable.findMany({
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
        await this.oracleDb.transaction(async (trx) => {
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
     * Invalidate the oracle trees needing updates
     */
    async invalidateOracleTree({
        oracleIds,
    }: {
        oracleIds: Set<number>;
    }) {
        if (oracleIds.size === 0) {
            return [];
        }
        // Get the product id from the oracle ids
        const productIdsFromDb = await this.oracleDb
            .select({
                productId: productOracleTable.productId,
            })
            .from(productOracleTable)
            .where(inArray(productOracleTable.id, Array.from(oracleIds)));
        const productIds = productIdsFromDb.map((product) => product.productId);
        log.debug(`Invalidate ${productIds.length} product trees`);

        // Invalidate the merkle tree
        this.merkleRepository.invalidateProductTrees({
            productIds,
        });

        return productIds;
    }

    /**
     * Update each products merkle root
     */
    async updateProductsMerkleRoot({
        productIds,
    }: {
        productIds: Hex[];
    }) {
        const oracleUpdater =
            await adminWalletsRepository.getKeySpecificAccount({
                key: "oracle-updater",
            });

        for (const productId of productIds) {
            // Build the merkle root
            const root = await this.merkleRepository.getMerkleRoot({
                productId,
            });
            // Update it in the database (and tell it's not synced yet)
            await this.oracleDb
                .update(productOracleTable)
                .set({ merkleRoot: root, synced: false })
                .where(eq(productOracleTable.productId, productId));
            log.debug(`Updated merkle root for product ${productId}`);

            // Blockchain update
            const { isSuccess, txHash } =
                await this.safeMerkleeRootBlockchainUpdate({
                    productId,
                    merkleRoot: root,
                    oracleUpdater,
                });

            // Update the synced status if it's a success
            if (isSuccess) {
                await this.oracleDb
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
    async safeMerkleeRootBlockchainUpdate({
        productId,
        merkleRoot,
        oracleUpdater,
    }: {
        productId: Hex;
        merkleRoot: Hex;
        oracleUpdater: LocalAccount;
    }) {
        // Get the current merklee root (and early exit if it's the same)
        const currentRoot = await readContract(viemClient, {
            abi: [purchaseOracle_getMerkleRoot],
            address: addresses.purchaseOracle,
            functionName: "getMerkleRoot",
            args: [BigInt(productId)],
        });

        if (currentRoot === merkleRoot) {
            log.debug(
                `Merkle root for product ${productId} is already up to date`
            );
            return { isSuccess: true };
        }

        try {
            // Simulate the tx first
            const { request } = await simulateContract(viemClient, {
                account: oracleUpdater,
                abi: [purchaseOracle_updateMerkleRoot],
                address: addresses.purchaseOracle,
                functionName: "updateMerkleRoot",
                args: [BigInt(productId), merkleRoot],
            });

            // Call the update function
            const txHash = await writeContract(viemClient, request);

            // Wait for the tx to be mined
            await waitForTransactionReceipt(viemClient, {
                hash: txHash,
                confirmations: 4,
                retryCount: 8,
            });
            log.info({ productId }, "Merkle update finalised");
            return { isSuccess: true, txHash };
        } catch (error) {
            log.error(
                { error },
                `Failed to update the merkle root on chain for ${productId}`
            );
            return { isSuccess: false };
        }
    }
}
