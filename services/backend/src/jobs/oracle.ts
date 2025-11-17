import { db, eventEmitter } from "@backend-infrastructure";
import { mutexCron } from "@backend-utils";
import { and, eq, isNotNull } from "drizzle-orm";
import Elysia from "elysia";
import { OracleContext, productOracleTable } from "../domain/oracle";

export const oracleJobs = new Elysia({ name: "Job.oracle" }).use(
    mutexCron({
        name: "updateMerkleRoot",
        pattern: "0 */5 * * * *", // Every 5 minutes
        skipIfLocked: true,
        run: async ({ context: { logger } }) => {
            // Get some unsynced products (products that failed to sync to blockchain)
            const notSyncedProductIds = await db
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

            // Get oracle IDs that meet threshold criteria for update
            const oracleIdsNeedingUpdate =
                await OracleContext.services.update.getOracleIdsNeedingUpdate();
            logger.debug(
                `${oracleIdsNeedingUpdate.size} oracles meet update criteria (threshold or age)`
            );

            // Early exit if nothing to do
            if (
                oracleIdsNeedingUpdate.size === 0 &&
                notSyncedProductIds.length === 0
            ) {
                logger.debug("No oracle to update");
                return;
            }

            // Update empty leafs only for oracles that need updates
            const updatedOracleIds =
                await OracleContext.services.update.updateEmptyLeafs(
                    oracleIdsNeedingUpdate
                );
            logger.debug(
                `Updated ${updatedOracleIds.size} oracles with new leafs`
            );

            // Invalidate the merkle tree for updated oracles
            const productIds =
                await OracleContext.services.update.invalidateOracleTree({
                    oracleIds: updatedOracleIds,
                });
            logger.debug(
                `Invalidating oracle for ${productIds.length} products`
            );

            // Combine with unsynced products (those that need blockchain retry)
            const finalProductIds = new Set(
                productIds.concat(
                    notSyncedProductIds.map((product) => product.productId)
                )
            );
            logger.debug(
                `Will update ${finalProductIds.size} products merkle tree`
            );

            // Update each product's merkle root and push to blockchain
            await OracleContext.services.update.updateProductsMerkleRoot({
                productIds: [...finalProductIds],
            });

            // Emit the oracle updated event
            eventEmitter.emit("oracleUpdated");
        },
    })
);
