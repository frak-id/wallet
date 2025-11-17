import { db, eventEmitter } from "@backend-infrastructure";
import { mutexCron } from "@backend-utils";
import type { pino } from "@bogeychan/elysia-logger";
import { isRunningInProd } from "@frak-labs/app-essentials";
import { eq } from "drizzle-orm";
import { Elysia } from "elysia";
import type { Address } from "viem";
import {
    InteractionsContext,
    pendingInteractionsTable,
} from "../../domain/interactions";
import { calculateNextRetry } from "../../domain/interactions/config/retryConfig";

export const simulateInteractionJob = new Elysia({
    name: "Job.interactions.simulate",
}).use(
    mutexCron({
        name: "simulateInteraction",
        triggerKeys: ["newInteractions"],
        pattern: isRunningInProd
            ? // Every minute on prod
              "*/1 * * * *"
            : // Every 30sec on dev
              "*/30 * * * * *",
        skipIfLocked: true,
        coolDownInMs: 1_000,
        run: async ({ context: { logger } }) => {
            // Get interactions to simulate (process even 1 interaction immediately)
            const interactions =
                await InteractionsContext.repositories.pendingInteractions.getAndLock(
                    {
                        status: "pending",
                    }
                );
            if (interactions.length === 0) {
                logger.debug("No interactions to simulate");
                return;
            }
            logger.debug(`Got ${interactions.length} interactions to simulate`);

            // todo: Base anti cheat system (for now just prevent unsafe purchase one)

            try {
                // Perform the simulation and update the interactions
                const hasSuccessInteractions =
                    await simulateAndUpdateInteractions({
                        interactions,
                        logger,
                    });

                logger.debug(
                    {
                        interactions: interactions.length,
                        hasSuccessInteractions,
                    },
                    "Simulated interactions"
                );

                // Emit the event to trigger the interaction execution
                if (hasSuccessInteractions) {
                    eventEmitter.emit("simulatedInteractions");
                }
            } finally {
                // Unlock the interactions
                await InteractionsContext.repositories.pendingInteractions.unlock(
                    interactions
                );
            }
        },
    })
);

/**
 * Simulate a list of transaction and update their state
 * @param interactions
 * @param interactionsDb
 * @param interactionDiamondRepository
 * @param walletSessionRepository
 * @param logger
 */
async function simulateAndUpdateInteractions({
    interactions,
    logger,
}: {
    interactions: (typeof pendingInteractionsTable.$inferSelect)[];
    logger: pino.Logger;
}) {
    // Get the unique wallets matching this interactions
    const wallets = new Set<Address>();
    for (const interaction of interactions) {
        wallets.add(interaction.wallet);
    }

    // Check the wallet sessions
    const walletSessionsStatesAsync = Array.from(wallets).map(
        async (wallet) => {
            const isSessionValid =
                await InteractionsContext.repositories.walletSession.isSessionValid(
                    wallet
                );
            return { wallet, isSessionValid };
        }
    );
    const walletSessionsStates = await Promise.all(walletSessionsStatesAsync);

    // Then perform the interactions check
    const simulationResultsAsync = interactions.map(async (interaction) => {
        // First check the wallet session in the result
        const isValidWalletSession =
            walletSessionsStates.find(
                (state) => state.wallet === interaction.wallet
            )?.isSessionValid ?? false;
        if (!isValidWalletSession) {
            return {
                interaction,
                simulationStatus: "no_session" as const,
                failureReason: "Wallet has no active session",
            };
        }

        // Check if backend signer is authorized for this product
        try {
            const { isAllowed, signerAddress } =
                await InteractionsContext.repositories.interactionSigner.checkSignerAllowedForProduct(
                    interaction.productId
                );

            if (!isAllowed) {
                logger.warn(
                    {
                        interactionId: interaction.id,
                        productId: interaction.productId,
                        signer: signerAddress,
                    },
                    "Backend signer not authorized for product"
                );
                return {
                    interaction,
                    simulationStatus: "failed" as const,
                    failureReason:
                        "Backend signer not authorized for this product",
                };
            }
        } catch (error) {
            logger.error(
                {
                    error,
                    interactionId: interaction.id,
                    productId: interaction.productId,
                },
                "Failed to check signer permission"
            );
            return {
                interaction,
                simulationStatus: "failed" as const,
                failureReason: "Unable to validate backend signer permissions",
            };
        }

        // Then perform the facet simulation
        try {
            const { isSimulationSuccess } =
                await InteractionsContext.repositories.interactionPacker.simulateInteraction(
                    {
                        wallet: interaction.wallet,
                        productId: interaction.productId,
                        interactionData: {
                            handlerTypeDenominator: interaction.typeDenominator,
                            interactionData: interaction.interactionData,
                        },
                    }
                );
            return {
                interaction,
                simulationStatus: isSimulationSuccess ? "succeeded" : "failed",
                failureReason: isSimulationSuccess
                    ? null
                    : "Simulation reverted on-chain",
            } as const;
        } catch (error) {
            logger.error(
                { error, interactionId: interaction.id },
                "Simulation threw error"
            );
            return {
                interaction,
                simulationStatus: "failed" as const,
                failureReason: `Simulation error: ${error instanceof Error ? error.message : "Unknown"}`,
            };
        }
    });
    const simulationResults = await Promise.all(simulationResultsAsync);

    // Then perform the db update accordingly to the simulation results
    try {
        await db.transaction(async (trx) => {
            for (const {
                interaction,
                simulationStatus,
                failureReason,
            } of simulationResults) {
                // For succeeded interactions, just update status
                if (simulationStatus === "succeeded") {
                    await trx
                        .update(pendingInteractionsTable)
                        .set({
                            status: simulationStatus,
                            failureReason: null,
                        })
                        .where(eq(pendingInteractionsTable.id, interaction.id));
                } else {
                    // For failed interactions, schedule retry with exponential backoff
                    const retryCount = (interaction.retryCount ?? 0) + 1;
                    const nextRetryAt = calculateNextRetry(
                        simulationStatus,
                        retryCount
                    );

                    await trx
                        .update(pendingInteractionsTable)
                        .set({
                            status: simulationStatus,
                            failureReason,
                            retryCount,
                            lastRetryAt: new Date(),
                            nextRetryAt,
                        })
                        .where(eq(pendingInteractionsTable.id, interaction.id));

                    logger.debug(
                        {
                            interactionId: interaction.id,
                            status: simulationStatus,
                            retryCount,
                            nextRetryAt,
                        },
                        "Scheduled retry for failed simulation"
                    );
                }
            }
        });
    } catch (e) {
        logger.error({ error: e }, "Error updating interactions");
    }

    // Return if we got success interactions (to know if we should trigger the push job)
    return simulationResults.some(
        (result) => result.simulationStatus === "succeeded"
    );
}
