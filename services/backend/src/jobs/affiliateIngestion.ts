import { tryWithAdvisoryLock } from "../infrastructure/persistence/postgres";
import { OrchestrationContext } from "../orchestration";
import { MutexCron } from "../utils/mutexCron";
import { CronRegistry } from "./registry";

/**
 * Advisory-lock key serializing the affiliate ingestion job across replicas.
 * Prevents duplicate TakeAds Stats API polling and duplicate interaction creation
 * under multi-replica deploys.
 */
const AFFILIATE_INGESTION_ADVISORY_LOCK_KEY = 0xaff111;

CronRegistry.register(
    new MutexCron({
        name: "ingestAffiliateActions",
        pattern: "0 * * * *",
        run: async ({ context: { logger } }) => {
            if (!process.env.TAKEADS_API_KEY) {
                logger.debug(
                    "Affiliate ingestion skipped — TAKEADS_API_KEY is not set"
                );
                return;
            }

            const outcome = await tryWithAdvisoryLock(
                AFFILIATE_INGESTION_ADVISORY_LOCK_KEY,
                () =>
                    OrchestrationContext.orchestrators.takeAdsIngestion.ingestActions()
            );

            if (!outcome.ran) {
                logger.info(
                    "Affiliate ingestion skipped — another replica holds the ingestion lock"
                );
                return;
            }

            const { result } = outcome;
            if (result.errors > 0) {
                logger.warn(
                    // The cursor is checkpointed per page and held at the last
                    // safe point; failed actions are retried next tick. Surface
                    // at warn for on-call.
                    {
                        ...result,
                        watermarkAdvanced: result.newWatermark !== null,
                    },
                    "Affiliate ingestion job completed with errors"
                );
            } else {
                logger.info(result, "Affiliate ingestion job completed");
            }
        },
    })
);
