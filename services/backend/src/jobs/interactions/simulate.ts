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
        coolDownInMs: 5_000,
        run: async ({ context: { logger } }) => {
            // Get interactions to simulate
            const interactions =
                await InteractionsContext.repositories.pendingInteractions.getAndLock(
                    {
                        status: "pending",
                        skipProcess: (interactions) => {
                            // Only execute if we got an interaction older than one min
                            const minimumDate = new Date(Date.now() - 60_000);
                            const hasOldInteractions = interactions.some(
                                (interaction) =>
                                    interaction.createdAt < minimumDate
                            );
                            return (
                                interactions.length < 2 && !hasOldInteractions
                            );
                        },
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
            return { interaction, simulationStatus: "no_session" } as const;
        }

        // Then perform the simulation
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
        } as const;
    });
    const simulationResults = await Promise.all(simulationResultsAsync);

    // Then perform the db update accordingly to the simulation results
    try {
        await db.transaction(async (trx) => {
            for (const { interaction, simulationStatus } of simulationResults) {
                await trx
                    .update(pendingInteractionsTable)
                    .set({ status: simulationStatus })
                    .where(eq(pendingInteractionsTable.id, interaction.id));
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
