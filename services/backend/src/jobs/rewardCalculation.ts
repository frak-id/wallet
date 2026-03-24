import { eventEmitter } from "@backend-infrastructure";
import { RewardConfig } from "../domain/rewards/config";
import { OrchestrationContext } from "../orchestration";
import { MutexCron } from "../utils/mutexCron";
import { CronRegistry } from "./registry";

CronRegistry.register(
    new MutexCron({
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
