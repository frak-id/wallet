import { businessMetrics } from "@backend-infrastructure";
import { RewardConfig } from "../domain/rewards/config";
import { tryWithAdvisoryLock } from "../infrastructure/persistence/postgres";
import { OrchestrationContext } from "../orchestration";
import { MutexCron } from "../utils/mutexCron";
import { SETTLEMENT_ADVISORY_LOCK_KEY } from "./locks";
import { CronRegistry } from "./registry";

CronRegistry.register(
    new MutexCron({
        name: "settleRewards",
        pattern: RewardConfig.cron.settlement,
        triggerKeys: ["newPendingRewards"],
        coolDownInMs: RewardConfig.settlement.cooldownMs,
        run: async ({ context: { logger } }) => {
            logger.debug("Starting reward settlement batch");

            const outcome = await tryWithAdvisoryLock(
                SETTLEMENT_ADVISORY_LOCK_KEY,
                async () => {
                    // Held rewards stay unclaimable on failure, so payouts go on.
                    await OrchestrationContext.orchestrators.missionUnlock
                        .run()
                        .catch((err) =>
                            logger.error({ err }, "Mission release failed")
                        );
                    return OrchestrationContext.orchestrators.settlement.runSettlement();
                },
                "settlement"
            );

            if (!outcome.ran) {
                logger.info(
                    "Settlement skipped — another replica holds the settlement lock"
                );
                return;
            }

            const { result } = outcome;
            businessMetrics.settlementRewards("settled", result.settledCount);
            businessMetrics.settlementRewards("failed", result.failedCount);
            businessMetrics.settlementRewards(
                "depleted",
                result.depletedCount ?? 0
            );
            businessMetrics.settlementTx(result.txHashes.length);
            businessMetrics.settlementErrors(result.errors.length);
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
