import { log } from "@backend-common";
import { mutexCron } from "@backend-utils";
import { Patterns } from "@elysiajs/cron";
import { eq } from "drizzle-orm";
import type { Address } from "viem";
import type { InteractionsContextApp, InteractionsDb } from "../context";
import { pendingInteractionsTable } from "../db/schema";
import type { InteractionDiamondRepository } from "../repositories/InteractionDiamondRepository";
import type { WalletSessionRepository } from "../repositories/WalletSessionRepository";
import type { ExecuteInteractionAppJob } from "./execute";

export const simulateInteractionJob = (app: InteractionsContextApp) =>
    app.use(
        mutexCron({
            name: "simulateInteraction",
            pattern: Patterns.everyMinutes(10),
            skipIfLocked: true,
            coolDownInMs: 500,
            protect: true,
            catch: true,
            interval: 5,
            run: async () => {
                // Get some stuff from the app
                const {
                    interactionsDb,
                    interactionDiamondRepository,
                    walletSessionRepository,
                    pendingInteractionsRepository,
                } = app.decorator;

                // Get interactions to simulate
                const interactions =
                    await pendingInteractionsRepository.getAndLock({
                        status: "pending",
                        skipProcess: (interactions) => {
                            // Dismiss interactions if we got less than 10 and if we didn't have any interactions older than 5 minutes
                            const fiveMinutesAgo = new Date(
                                Date.now() - 5 * 60 * 1000
                            );
                            const hasInteractions5MinOld = interactions.some(
                                (interaction) =>
                                    interaction.createdAt < fiveMinutesAgo
                            );
                            return (
                                interactions.length < 3 &&
                                !hasInteractions5MinOld
                            );
                        },
                    });
                if (interactions.length === 0) {
                    log.debug("No interactions to simulate");
                    return;
                }
                log.debug(
                    `Got ${interactions.length} interactions to simulate`
                );

                try {
                    // Perform the simulation and update the interactions
                    const hasSuccessInteractions =
                        await simulateAndUpdateInteractions({
                            interactions,
                            interactionsDb,
                            interactionDiamondRepository,
                            walletSessionRepository,
                        });

                    log.debug("Simulated interactions", {
                        interactions: interactions.length,
                        hasSuccessInteractions,
                    });

                    // Trigger the execution job
                    const store =
                        app.store as ExecuteInteractionAppJob["store"];
                    await store.cron.executeInteraction.trigger();
                } finally {
                    // Unlock the interactions
                    pendingInteractionsRepository.unlock(interactions);
                }
            },
        })
    );

export type SimulateInteractionAppJob = ReturnType<
    typeof simulateInteractionJob
>;

/**
 * Simulate a list of transaction and update their state
 * @param interactions
 * @param interactionsDb
 * @param interactionDiamondRepository
 * @param walletSessionRepository
 */
async function simulateAndUpdateInteractions({
    interactions,
    interactionsDb,
    interactionDiamondRepository,
    walletSessionRepository,
}: {
    interactions: (typeof pendingInteractionsTable.$inferSelect)[];
    interactionsDb: InteractionsDb;
    interactionDiamondRepository: InteractionDiamondRepository;
    walletSessionRepository: WalletSessionRepository;
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
                await walletSessionRepository.isSessionValid(wallet);
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
            await interactionDiamondRepository.simulateInteraction({
                wallet: interaction.wallet,
                productId: interaction.productId,
                interactionData: {
                    handlerTypeDenominator: interaction.typeDenominator,
                    interactionData: interaction.interactionData,
                },
            });
        return {
            interaction,
            simulationStatus: isSimulationSuccess ? "succeeded" : "failed",
        } as const;
    });
    const simulationResults = await Promise.all(simulationResultsAsync);

    // Then perform the db update accordingly to the simulation results
    try {
        await interactionsDb.transaction(async (trx) => {
            for (const { interaction, simulationStatus } of simulationResults) {
                await trx
                    .update(pendingInteractionsTable)
                    .set({ status: simulationStatus })
                    .where(eq(pendingInteractionsTable.id, interaction.id));
            }
        });
    } catch (e) {
        log.error({ error: e }, "Error updating interactions");
    }

    // Return if we got success interactions (to know if we should trigger the push job)
    return simulationResults.some(
        (result) => result.simulationStatus === "succeeded"
    );
}
