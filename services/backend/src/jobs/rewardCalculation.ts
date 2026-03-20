import { eventEmitter } from "@backend-infrastructure";
import { mutexCron } from "@backend-utils";
import { Elysia } from "elysia";
import { RewardConfig } from "../domain/rewards/config";
import { OrchestrationContext } from "../orchestration";

export const rewardCalculationJobs = new Elysia({
    name: "Job.rewardCalculation",
}).use(
    mutexCron({
        name: "processRewards",
        pattern: RewardConfig.cron.rewardCalculation,
        triggerKeys: ["newInteraction"],
        coolDownInMs: 15_000,
        run: async ({ context: { logger } }) => {
            logger.debug("Starting reward calculation batch");

            const result =
                await OrchestrationContext.orchestrators.batchReward.processPendingInteractions(
                    {
                        limit: RewardConfig.batch.size,
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
