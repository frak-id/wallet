import { RewardConfig } from "../domain/rewards/config";
import { OrchestrationContext } from "../orchestration";
import { MutexCron } from "../utils/mutexCron";
import { CronRegistry } from "./registry";

CronRegistry.register(
    new MutexCron({
        name: "expireRewards",
        pattern: RewardConfig.cron.expiration,
        run: async ({ context: { logger } }) => {
            logger.debug("Starting reward expiration job");

            const result =
                await OrchestrationContext.orchestrators.rewardLifecycle.expireOverdueRewards();

            logger.info(
                {
                    expiredCount: result.affectedCount,
                    campaignsAffected: Object.keys(
                        result.budgetRestoredByCampaign
                    ).length,
                },
                "Expiration job completed"
            );
        },
    })
);
