import { db, eventEmitter } from "@backend-infrastructure";
import { mutexCron } from "@backend-utils";
import { and, eq, isNull, lte, or } from "drizzle-orm";
import { Elysia } from "elysia";
import {
    InteractionsContext,
    pendingInteractionsTable,
} from "../../domain/interactions";
import {
    hasExceededMaxRetries,
    type RetryStatus,
} from "../../domain/interactions/config/retryConfig";

export const retryInteractionJob = new Elysia({
    name: "Job.interactions.retry",
}).use(
    mutexCron({
        name: "retryInteractions",
        pattern: "*/30 * * * *", // Every 30 minutes
        skipIfLocked: true,
        run: async ({ context: { logger } }) => {
            const now = new Date();

            // Find interactions ready for retry
            const toRetry = await db
                .select()
                .from(pendingInteractionsTable)
                .where(
                    and(
                        // Status is failed, no_session, or execution_failed
                        or(
                            eq(pendingInteractionsTable.status, "no_session"),
                            eq(pendingInteractionsTable.status, "failed"),
                            eq(
                                pendingInteractionsTable.status,
                                "execution_failed"
                            )
                        ),
                        // Not locked
                        isNull(pendingInteractionsTable.lockedAt),
                        // Ready for retry (next_retry_at is null or in the past)
                        or(
                            isNull(pendingInteractionsTable.nextRetryAt),
                            lte(pendingInteractionsTable.nextRetryAt, now)
                        )
                    )
                )
                .limit(100);

            if (toRetry.length === 0) {
                logger.debug("No interactions ready for retry");
                return;
            }

            logger.info(`Found ${toRetry.length} interactions to retry`);

            // Categorize interactions in a single pass using reduce
            // Note: retryCount and nextRetryAt were already calculated by simulate/execute jobs
            // We just use the existing values from the DB
            const { toArchive, toResetForExecution, toResetForSimulation } =
                toRetry.reduce<{
                    toArchive: typeof toRetry;
                    toResetForExecution: { id: number }[];
                    toResetForSimulation: { id: number }[];
                }>(
                    (acc, interaction) => {
                        const status = interaction.status as RetryStatus;
                        const retryCount = interaction.retryCount ?? 0;

                        // Check if max attempts reached
                        if (hasExceededMaxRetries(status, retryCount)) {
                            logger.debug(
                                {
                                    id: interaction.id,
                                    status,
                                    retryCount,
                                },
                                "Max retries exceeded, will archive"
                            );
                            acc.toArchive.push(interaction);
                            return acc;
                        }

                        // execution_failed → reset to succeeded (skip simulation)
                        // failed/no_session → reset to pending (need re-simulation)
                        if (status === "execution_failed") {
                            acc.toResetForExecution.push({
                                id: interaction.id,
                            });
                        } else {
                            acc.toResetForSimulation.push({
                                id: interaction.id,
                            });
                        }

                        return acc;
                    },
                    {
                        toArchive: [],
                        toResetForExecution: [],
                        toResetForSimulation: [],
                    }
                );

            // Reset execution-failed interactions to succeeded
            if (toResetForExecution.length > 0) {
                await InteractionsContext.repositories.pendingInteractions.resetForExecution(
                    toResetForExecution.map((i) => i.id)
                );

                // Trigger execution
                eventEmitter.emit("simulatedInteractions");

                logger.info(
                    `Reset ${toResetForExecution.length} execution_failed interactions to succeeded`
                );
            }

            // Reset simulation-failed interactions to pending
            if (toResetForSimulation.length > 0) {
                await InteractionsContext.repositories.pendingInteractions.resetForSimulation(
                    toResetForSimulation.map((i) => i.id)
                );

                // Trigger simulation
                eventEmitter.emit("newInteractions");

                logger.info(
                    `Reset ${toResetForSimulation.length} simulation-failed interactions to pending`
                );
            }

            // Archive exceeded interactions
            if (toArchive.length > 0) {
                await InteractionsContext.repositories.archive.archiveInteractions(
                    toArchive,
                    "max_retries"
                );

                logger.info(
                    {
                        count: toArchive.length,
                    },
                    "Archived interactions that exceeded max retries"
                );
            }
        },
    })
);
