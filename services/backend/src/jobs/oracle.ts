import { eventEmitter } from "@backend-common";
import { mutexCron } from "@backend-utils";
import { and, eq, isNotNull } from "drizzle-orm";
import Elysia from "elysia";
import {
    type OracleContextApp,
    oracleContext,
    productOracleTable,
} from "../domain/oracle";

const updateMerkleRootJob = (app: OracleContextApp) =>
    app.use(
        mutexCron({
            name: "updateMerkleRoot",
            pattern: "0 */5 * * * *", // Every 5 minutes
            skipIfLocked: true,
            run: async ({ context: { logger } }) => {
                const {
                    oracle: { db: oracleDb, updateService },
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
                const updatedOracleIds = await updateService.updateEmptyLeafs();
                if (
                    updatedOracleIds.size === 0 &&
                    notSyncedProductIds.length === 0
                ) {
                    logger.debug("No oracle to update");
                    return;
                }

                // Invalidate the merkle tree
                const productIds = await updateService.invalidateOracleTree({
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
                await updateService.updateProductsMerkleRoot({
                    productIds: [...finalProductIds],
                });

                // Then emit the oracle updated event
                eventEmitter.emit("oracleUpdated");
            },
        })
    );

export const oracleJobs = new Elysia({ name: "Jobs.oracle" })
    .use(oracleContext)
    .use(updateMerkleRootJob);
