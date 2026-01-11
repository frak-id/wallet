import { eventEmitter } from "@backend-infrastructure";
import { mutexCron } from "@backend-utils";
import { Elysia } from "elysia";
import { OrchestrationContext } from "../orchestration";

const BATCH_SIZE = 100;
const MIN_AGE_SECONDS = 60;

export const rewardCalculationJobs = new Elysia({
    name: "Job.rewardCalculation",
}).use(
    mutexCron({
        name: "processRewards",
        pattern: "0 */5 * * * *",
        triggerKeys: ["newInteraction"],
        coolDownInMs: 15_000,
        skipIfLocked: true,
        run: async ({ context: { logger } }) => {
            logger.debug("Starting reward calculation batch");

            const result =
                await OrchestrationContext.orchestrators.batchReward.processPendingInteractions(
                    {
                        limit: BATCH_SIZE,
                        minAgeSeconds: MIN_AGE_SECONDS,
                    }
                );

            logger.info(
                {
                    processedCount: result.processedCount,
                    rewardsCreated: result.rewardsCreated,
                    errorCount: result.errors.length,
                },
                "Reward calculation job completed"
            );

            if (result.errors.length > 0) {
                logger.warn(
                    {
                        errors: result.errors,
                        totalErrors: result.errors.length,
                    },
                    "Reward calculation job had errors"
                );
            }

            if (result.rewardsCreated > 0) {
                eventEmitter.emit("newPendingRewards", {
                    count: result.rewardsCreated,
                });
            }
        },
    })
);
