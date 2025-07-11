import { mutexCron } from "@backend-utils";
import type { pino } from "@bogeychan/elysia-logger";
import { inArray } from "drizzle-orm";
import {
    type InteractionPackerRepository,
    type InteractionSignerRepository,
    type InteractionsContextApp,
    type InteractionsDb,
    type PreparedInteraction,
    pendingInteractionsTable,
    pushedInteractionsTable,
} from "../../domain/interactions";

export const executeInteractionJob = (app: InteractionsContextApp) =>
    app.use(
        mutexCron({
            name: "executeInteraction",
            pattern: "0 */3 * * * *", // Every 3 minutes
            skipIfLocked: true,
            coolDownInMs: 2_000,
            run: async ({ context: { logger } }) => {
                const {
                    interactions: { db: interactionsDb },
                    interactions: {
                        repositories: {
                            interactionPacker: interactionPackerRepository,
                            interactionSigner: interactionSignerRepository,
                            pendingInteractions: pendingInteractionsRepository,
                        },
                    },
                } = app.decorator;
                // Get interactions to simulate
                const interactions =
                    await pendingInteractionsRepository.getAndLock({
                        status: "succeeded",
                        limit: 200,
                    });
                if (interactions.length === 0) {
                    logger.debug("No interactions to execute");
                    return;
                }
                logger.debug(
                    `Will execute ${interactions.length} interactions`
                );

                try {
                    // Execute them
                    await executeInteractions({
                        interactions,
                        interactionsDb,
                        interactionPackerRepository,
                        interactionSignerRepository,
                        logger,
                    });
                } finally {
                    // Unlock them
                    await pendingInteractionsRepository.unlock(interactions);
                }
            },
        })
    );

/**
 * Execute a list of interactions
 */
async function executeInteractions({
    interactions,
    interactionsDb,
    interactionPackerRepository,
    interactionSignerRepository,
    logger,
}: {
    interactions: (typeof pendingInteractionsTable.$inferSelect)[];
    interactionsDb: InteractionsDb;
    interactionPackerRepository: InteractionPackerRepository;
    interactionSignerRepository: InteractionSignerRepository;
    logger: pino.Logger;
}) {
    // Prepare and pack every interaction
    const preparedInteractionsAsync = interactions.map(async (interaction) => {
        // Get the signature
        const signature =
            interaction.signature ??
            (await interactionSignerRepository.signInteraction({
                user: interaction.wallet,
                facetData: interaction.interactionData,
                productId: interaction.productId,
            }));
        if (!signature) {
            logger.warn(
                {
                    interaction,
                },
                "Failed to get signature for interaction"
            );
            return null;
        }

        // Pack it for execution
        const packedInteraction =
            interactionPackerRepository.packageInteractionData({
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
        await interactionSignerRepository.pushPreparedInteractions(
            preparedInteractions
        );
    if (!txHash) {
        logger.error(
            {
                preparedInteractions: preparedInteractions.length,
            },
            "Failed to push interactions"
        );
        return undefined;
    }
    logger.info({ txHash }, "Pushed all the interactions on txs");

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
}
