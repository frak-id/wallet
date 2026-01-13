import { mutexCron } from "@backend-utils";
import { Elysia } from "elysia";
import { RewardConfig } from "../domain/rewards/config";
import { OrchestrationContext } from "../orchestration";

export const expirationJobs = new Elysia({ name: "Job.expiration" }).use(
    mutexCron({
        name: "expireRewards",
        pattern: RewardConfig.cron.expiration,
        skipIfLocked: true,
        run: async ({ context: { logger } }) => {
            logger.debug("Starting reward expiration job");

            const result =
                await OrchestrationContext.orchestrators.rewardExpiration.expireAndRestoreBudgets();

            logger.info(
                {
                    expiredCount: result.expiredCount,
                    campaignsAffected: Object.keys(
                        result.budgetRestoredByCampaign
                    ).length,
                },
                "Expiration job completed"
            );
        },
    })
);
