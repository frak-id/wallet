import cron, { Patterns } from "@elysiajs/cron";
import { Mutex } from "async-mutex";
import { and, eq, inArray } from "drizzle-orm";
import {
    pendingInteractionsTable,
    pushedInteractionsTable,
} from "../../db/schema";
import type { InteractionsContextApp, InteractionsDb } from "../context";
import type { InteractionDiamondRepository } from "../repositories/InteractionDiamondRepository";
import type { InteractionSignerRepository } from "../repositories/InteractionSignerRepository";
import type { PreparedInteraction } from "../types/interactions";

export function executeInteractionJob(app: InteractionsContextApp) {
    const executionMutex = new Mutex();

    return app.use(
        cron({
            name: "executeInteraction",
            pattern: Patterns.everyMinutes(30),
            run: () =>
                executionMutex.runExclusive(async () => {
                    // Get some stuff from the app
                    const {
                        interactionsDb,
                        interactionDiamondRepository,
                        interactionSignerRepository,
                    } = app.decorator;

                    // Get interactions to simulate
                    const interactions = await getInteractionsToExecute({
                        interactionsDb,
                    });
                    if (interactions.length === 0) {
                        console.log("No interactions to execute");
                        return;
                    }
                    console.log("Will execute interactions", {
                        interactions: interactions.length,
                    });

                    // Execute them
                    const txHash = await executeInteractions({
                        interactions,
                        interactionsDb,
                        interactionDiamondRepository,
                        interactionSignerRepository,
                    });

                    console.log("Executed interactions", {
                        interactions: interactions.length,
                        txHash,
                    });
                }),
        })
    );
}

export type ExecuteInteractionAppJob = ReturnType<typeof executeInteractionJob>;

/**
 * Get list of interactions to execute
 * todo:
 *  - Use the locked bool
 *  - Min 10 or 1 if older than 5min
 * @param interactionsDb
 */
function getInteractionsToExecute({
    interactionsDb,
}: { interactionsDb: InteractionsDb }) {
    return interactionsDb
        .select()
        .from(pendingInteractionsTable)
        .where(
            and(
                eq(pendingInteractionsTable.status, "succeeded"),
                eq(pendingInteractionsTable.locked, false)
            )
        );
}

/**
 * Execute a list of interactions
 */
async function executeInteractions({
    interactions,
    interactionsDb,
    interactionDiamondRepository,
    interactionSignerRepository,
}: {
    interactions: (typeof pendingInteractionsTable.$inferSelect)[];
    interactionsDb: InteractionsDb;
    interactionDiamondRepository: InteractionDiamondRepository;
    interactionSignerRepository: InteractionSignerRepository;
}) {
    // Prepare and pack every interaction
    const preparedInteractionsAsync = interactions.map(async (interaction) => {
        // Get the diamond for id
        const interactionContract =
            await interactionDiamondRepository.getDiamondContract(
                interaction.productId
            );
        if (!interactionContract) {
            return null;
        }

        // Get the signature
        const signature =
            interaction.signature ??
            (await interactionSignerRepository.signInteraction({
                user: interaction.wallet,
                facetData: interaction.interactionData,
                productId: interaction.productId,
                interactionContract,
            }));
        if (!signature) {
            console.error("Failed to get signature for interaction", {
                interaction,
            });
            return null;
        }

        // Pack it for execution
        const packedInteraction =
            interactionDiamondRepository.packageInteractionData({
                interactionData: {
                    handlerTypeDenominator: interaction.typeDenominator,
                    interactionData: interaction.interactionData,
                },
                signature,
            });
        return {
            interaction,
            signature,
            packedInteraction,
        };
    });
    const preparedInteractions = (
        await Promise.all(preparedInteractionsAsync)
    ).filter((out) => out !== null) as PreparedInteraction[];
    if (preparedInteractions.length === 0) {
        console.log("No interactions to execute post preparation");
        return undefined;
    }
    console.log("Prepared interactions", {
        interactions: preparedInteractions.length,
    });

    // Once all prepared, send them
    const txHash =
        await interactionSignerRepository.pushPreparedInteractions(
            preparedInteractions
        );
    if (!txHash) {
        console.error("Failed to push interactions", {
            preparedInteractions: preparedInteractions.length,
        });
        return undefined;
    }
    console.log("Pushed all the interactions on txs", { txHash });

    // Update the db
    await interactionsDb.transaction(async (trx) => {
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

    // Return the tx hash
    return txHash;
}
