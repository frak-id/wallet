import { db } from "@backend-infrastructure";
import { mutexCron } from "@backend-utils";
import type { pino } from "@bogeychan/elysia-logger";
import { eq, inArray } from "drizzle-orm";
import { Elysia } from "elysia";
import {
    InteractionsContext,
    type PreparedInteraction,
    pendingInteractionsTable,
    pushedInteractionsTable,
} from "../../domain/interactions";
import { calculateNextRetry } from "../../domain/interactions/config/retryConfig";

export const executeInteractionJob = new Elysia({
    name: "Job.interactions.execute",
}).use(
    mutexCron({
        name: "executeInteraction",
        triggerKeys: ["simulatedInteractions"],
        pattern: "0 */3 * * * *", // Every 3 minutes
        skipIfLocked: true,
        coolDownInMs: 1_000,
        run: async ({ context: { logger } }) => {
            // Get interactions to simulate
            const interactions =
                await InteractionsContext.repositories.pendingInteractions.getAndLock(
                    {
                        status: "succeeded",
                        limit: 200,
                    }
                );
            if (interactions.length === 0) {
                logger.debug("No interactions to execute");
                return;
            }
            logger.debug(`Will execute ${interactions.length} interactions`);

            try {
                // Execute them
                await executeInteractions({
                    interactions,
                    logger,
                });
            } finally {
                // Unlock them
                await InteractionsContext.repositories.pendingInteractions.unlock(
                    interactions
                );
            }
        },
    })
);

/**
 * Execute a list of interactions
 */
async function executeInteractions({
    interactions,
    logger,
}: {
    interactions: (typeof pendingInteractionsTable.$inferSelect)[];
    logger: pino.Logger;
}) {
    const failedSignatures: number[] = [];

    // Prepare and pack every interaction
    const preparedInteractionsAsync = interactions.map(async (interaction) => {
        // Get the signature
        const signature =
            interaction.signature ??
            (await InteractionsContext.repositories.interactionSigner.signInteraction(
                {
                    user: interaction.wallet,
                    facetData: interaction.interactionData,
                    productId: interaction.productId,
                }
            ));
        if (!signature) {
            logger.warn(
                {
                    interactionId: interaction.id,
                    productId: interaction.productId,
                },
                "Failed to get signature for interaction"
            );
            failedSignatures.push(interaction.id);
            return null;
        }

        // Pack it for execution
        const packedInteraction =
            InteractionsContext.repositories.interactionPacker.packageInteractionData(
                {
                    interactionData: {
                        handlerTypeDenominator: interaction.typeDenominator,
                        interactionData: interaction.interactionData,
                    },
                    signature,
                }
            );
        return {
            interaction,
            signature,
            packedInteraction,
        };
    });
    const preparedInteractions = (
        await Promise.all(preparedInteractionsAsync)
    ).filter((out) => out !== null) as PreparedInteraction[];

    // Mark interactions that failed signature generation as execution_failed
    if (failedSignatures.length > 0) {
        // Get the interactions that failed to calculate retry schedule
        const failedInteractions = interactions.filter((i) =>
            failedSignatures.includes(i.id)
        );

        for (const interaction of failedInteractions) {
            const retryCount = (interaction.retryCount ?? 0) + 1;
            const nextRetryAt = calculateNextRetry(
                "execution_failed",
                retryCount
            );

            await db
                .update(pendingInteractionsTable)
                .set({
                    status: "execution_failed",
                    failureReason:
                        "Failed to generate signature for interaction",
                    retryCount,
                    lastRetryAt: new Date(),
                    nextRetryAt,
                })
                .where(eq(pendingInteractionsTable.id, interaction.id));

            logger.debug(
                {
                    interactionId: interaction.id,
                    retryCount,
                    nextRetryAt,
                },
                "Scheduled retry for signature generation failure"
            );
        }

        logger.warn(
            {
                count: failedSignatures.length,
                ids: failedSignatures,
            },
            "Marked interactions with failed signatures as execution_failed"
        );
    }

    if (preparedInteractions.length === 0) {
        logger.debug("No interactions to execute post preparation");
        return undefined;
    }
    logger.debug(
        {
            interactions: preparedInteractions.length,
        },
        "Prepared interactions"
    );

    // Once all prepared, send them
    const txHash =
        await InteractionsContext.repositories.interactionSigner.pushPreparedInteractions(
            preparedInteractions
        );
    if (!txHash) {
        logger.error(
            {
                preparedInteractions: preparedInteractions.length,
            },
            "Failed to push interactions on-chain"
        );

        // Mark these interactions as execution_failed so they can be retried quickly
        for (const { interaction } of preparedInteractions) {
            const retryCount = (interaction.retryCount ?? 0) + 1;
            const nextRetryAt = calculateNextRetry(
                "execution_failed",
                retryCount
            );

            await db
                .update(pendingInteractionsTable)
                .set({
                    status: "execution_failed",
                    failureReason: "Failed to push transaction on-chain",
                    retryCount,
                    lastRetryAt: new Date(),
                    nextRetryAt,
                })
                .where(eq(pendingInteractionsTable.id, interaction.id));

            logger.debug(
                {
                    interactionId: interaction.id,
                    retryCount,
                    nextRetryAt,
                },
                "Scheduled retry for on-chain push failure"
            );
        }

        logger.warn(
            {
                count: preparedInteractions.length,
            },
            "Marked interactions as execution_failed due to on-chain push failure"
        );
        return undefined;
    }
    logger.info({ txHash }, "Pushed all the interactions on txs");

    // Update the db - this is critical, if it fails we have a problem
    try {
        await db.transaction(async (trx) => {
            // Insert all the pushed one in the pushed table
            for (const { interaction, signature } of preparedInteractions) {
                await trx.insert(pushedInteractionsTable).values({
                    ...interaction,
                    signature,
                    txHash,
                });
            }
            // Delete all the pending ones
            await trx.delete(pendingInteractionsTable).where(
                inArray(
                    pendingInteractionsTable.id,
                    preparedInteractions.map((out) => out.interaction.id)
                )
            );
        });
    } catch (error) {
        // This is a critical error - transaction was pushed on-chain but DB update failed
        // This could lead to duplicate pushes if not handled
        logger.error(
            {
                error,
                txHash,
                interactionIds: preparedInteractions.map(
                    (out) => out.interaction.id
                ),
            },
            "CRITICAL: Failed to update DB after successful on-chain push - interactions may be duplicated on retry"
        );
        // Don't mark as failed since they're already on-chain
        // Leave them locked - manual intervention needed
        throw error;
    }
}
