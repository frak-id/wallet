import {
    adminWalletsRepository,
    db,
    log,
    viemClient,
} from "@backend-infrastructure";
import { addresses } from "@frak-labs/app-essentials";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { encodePacked, type Hex, type LocalAccount } from "viem";
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
import { interactionsPurchaseTrackerTable } from "../../interactions/db/schema";
import { productOracleTable, purchaseStatusTable } from "../db/schema";
import type { MerkleTreeRepository } from "../repositories/MerkleTreeRepository";

// 50 items waiting for update
const ORACLE_UPDATE_THRESHOLD = Number.parseInt(
    process.env.ORACLE_UPDATE_THRESHOLD ?? "50",
    10
);

// 24hr
const ORACLE_UPDATE_MAX_AGE_MINUTES = Number.parseInt(
    process.env.ORACLE_UPDATE_MAX_AGE_MINUTES ?? "1440",
    10
);

export class UpdateOracleService {
    constructor(private readonly merkleRepository: MerkleTreeRepository) {}

    /**
     * Get oracle IDs that need updates based on threshold criteria
     * Returns oracles with either:
     * - Has pending interaction trackers waiting for proof (user actively waiting)
     * - Pending leaf count >= threshold
     * - Oldest pending leaf older than max age
     */
    async getOracleIdsNeedingUpdate(): Promise<Set<number>> {
        // First, get oracle IDs that have interaction trackers waiting (user actively waiting for proof)
        const oraclesWithTrackers = await db
            .selectDistinct({
                oracleId: purchaseStatusTable.oracleId,
            })
            .from(interactionsPurchaseTrackerTable)
            .innerJoin(
                purchaseStatusTable,
                and(
                    eq(
                        interactionsPurchaseTrackerTable.externalPurchaseId,
                        purchaseStatusTable.externalId
                    ),
                    eq(
                        interactionsPurchaseTrackerTable.externalCustomerId,
                        purchaseStatusTable.externalCustomerId
                    )
                )
            )
            .where(
                and(
                    eq(interactionsPurchaseTrackerTable.pushed, false),
                    isNull(purchaseStatusTable.leaf) // Only count if leaf not yet generated
                )
            );

        const oracleIds = new Set<number>();

        // Priority: oracles with user trackers (immediate processing)
        for (const { oracleId } of oraclesWithTrackers) {
            oracleIds.add(oracleId);
            log.debug(
                { oracleId, reason: "interaction-tracker" },
                "Oracle needs immediate update (user waiting for proof)"
            );
        }

        // Query to get pending leaf counts and oldest leaf timestamp per oracle
        const oraclePendingStats = await db
            .select({
                oracleId: purchaseStatusTable.oracleId,
                pendingCount: sql<number>`count(*)::int`,
                oldestPending: sql<Date>`min(${purchaseStatusTable.updatedAt})`,
            })
            .from(purchaseStatusTable)
            .where(isNull(purchaseStatusTable.leaf))
            .groupBy(purchaseStatusTable.oracleId);

        const now = new Date();
        const maxAgeMs = ORACLE_UPDATE_MAX_AGE_MINUTES * 60 * 1000;

        // Fallback criteria: threshold or age
        for (const stats of oraclePendingStats) {
            // Skip if already added due to tracker
            if (oracleIds.has(stats.oracleId)) {
                continue;
            }

            const ageSinceOldest =
                now.getTime() - new Date(stats.oldestPending).getTime();
            const shouldUpdate =
                stats.pendingCount >= ORACLE_UPDATE_THRESHOLD ||
                ageSinceOldest >= maxAgeMs;

            if (shouldUpdate) {
                oracleIds.add(stats.oracleId);
                log.debug(
                    {
                        oracleId: stats.oracleId,
                        pendingCount: stats.pendingCount,
                        ageMinutes: Math.floor(ageSinceOldest / 60000),
                        reason:
                            stats.pendingCount >= ORACLE_UPDATE_THRESHOLD
                                ? "threshold"
                                : "age",
                    },
                    "Oracle needs update"
                );
            }
        }

        return oracleIds;
    }

    /**
     * Update all the empty leafs if needed
     * @param filterOracleIds - Optional set of oracle IDs to filter updates to
     */
    async updateEmptyLeafs(
        filterOracleIds?: Set<number>
    ): Promise<Set<number>> {
        // Get all purchase with empty leafs
        const allPurchases = await db.query.purchaseStatusTable.findMany({
            where: isNull(purchaseStatusTable.leaf),
        });

        // Filter to only specified oracles if provided
        const purchases = filterOracleIds
            ? allPurchases.filter((p) => filterOracleIds.has(p.oracleId))
            : allPurchases;

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
        await db.transaction(async (trx) => {
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
    async invalidateOracleTree({ oracleIds }: { oracleIds: Set<number> }) {
        if (oracleIds.size === 0) {
            return [];
        }
        // Get the product id from the oracle ids
        const productIdsFromDb = await db
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
    async updateProductsMerkleRoot({ productIds }: { productIds: Hex[] }) {
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
            await db
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
                await db
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
