import { RewardConfig } from "../domain/rewards/config";
import { tryWithAdvisoryLock } from "../infrastructure/persistence/postgres";
import { OrchestrationContext } from "../orchestration";
import { MutexCron } from "../utils/mutexCron";
import { SETTLEMENT_ADVISORY_LOCK_KEY } from "./locks";
import { CronRegistry } from "./registry";

CronRegistry.register(
    new MutexCron({
        name: "expireRewards",
        pattern: RewardConfig.cron.expiration,
        run: async ({ context: { logger } }) => {
            logger.debug("Starting reward expiration job");

            // A reward whose mission was just met gets its payout window first.
            await tryWithAdvisoryLock(
                SETTLEMENT_ADVISORY_LOCK_KEY,
                () => OrchestrationContext.orchestrators.missionUnlock.run(),
                "mission-release"
            );

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
