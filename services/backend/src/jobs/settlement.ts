import { businessMetrics } from "@backend-infrastructure";
import { RewardConfig } from "../domain/rewards/config";
import { tryWithAdvisoryLock } from "../infrastructure/persistence/postgres";
import { OrchestrationContext } from "../orchestration";
import { MutexCron } from "../utils/mutexCron";
import { CronRegistry } from "./registry";

/**
 * Advisory-lock key serializing the settlement job across replicas. With the
 * atomic row claim in `AssetLogRepository.claimPendingForSettlement`, this
 * keeps a single process pushing rewards on-chain at a time — preventing
 * double-pays and rewarder-EOA nonce collisions under multi-replica deploys.
 */
const SETTLEMENT_ADVISORY_LOCK_KEY = 0x5e771e;

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
                () =>
                    OrchestrationContext.orchestrators.settlement.runSettlement(),
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
