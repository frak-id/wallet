import { RewardConfig } from "../domain/rewards/config";
import { OrchestrationContext } from "../orchestration";
import { MutexCron } from "../utils/mutexCron";
import { CronRegistry } from "./registry";

CronRegistry.register(
    new MutexCron({
        name: "settleRewards",
        pattern: RewardConfig.cron.settlement,
        triggerKeys: ["newPendingRewards"],
        coolDownInMs: RewardConfig.settlement.cooldownMs,
        run: async ({ context: { logger } }) => {
            logger.debug("Starting reward settlement batch");

            const result =
                await OrchestrationContext.orchestrators.settlement.runSettlement();

            logger.info(
                {
                    settled: result.settledCount,
                    failed: result.failedCount,
                    txCount: result.txHashes.length,
                    errorCount: result.errors.length,
                },
                "Settlement job completed"
            );

            if (result.errors.length > 0) {
                logger.warn(
                    {
                        errors: result.errors,
                        totalErrors: result.errors.length,
                    },
                    "Settlement job had errors"
                );
            }
        },
    })
);
