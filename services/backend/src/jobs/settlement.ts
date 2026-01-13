import { mutexCron } from "@backend-utils";
import { Elysia } from "elysia";
import { RewardConfig } from "../domain/rewards/config";
import { OrchestrationContext } from "../orchestration";

export const settlementJobs = new Elysia({ name: "Job.settlement" }).use(
    mutexCron({
        name: "settleRewards",
        pattern: RewardConfig.cron.settlement,
        triggerKeys: ["newPendingRewards"],
        coolDownInMs: RewardConfig.settlement.cooldownMs,
        skipIfLocked: true,
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
