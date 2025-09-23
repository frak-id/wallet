import { eventEmitter } from "@backend-common";
import { db } from "@backend-common";
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
            // Get some unsynced products
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

            // Update the empty leafs
            const updatedOracleIds =
                await OracleContext.services.update.updateEmptyLeafs();
            if (
                updatedOracleIds.size === 0 &&
                notSyncedProductIds.length === 0
            ) {
                logger.debug("No oracle to update");
                return;
            }

            // Invalidate the merkle tree
            const productIds =
                await OracleContext.services.update.invalidateOracleTree({
                    oracleIds: updatedOracleIds,
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
            await OracleContext.services.update.updateProductsMerkleRoot({
                productIds: [...finalProductIds],
            });

            // Then emit the oracle updated event
            eventEmitter.emit("oracleUpdated");
        },
    })
);
