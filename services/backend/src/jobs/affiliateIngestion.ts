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
            const summary = {
                pages: result.pages,
                processed: result.processed,
                created: result.created,
                custom: result.custom,
                cancelled: result.cancelled,
                skipped: result.skipped,
                errors: result.errors,
                newWatermark: result.newWatermark,
            };
            if (result.errors > 0) {
                logger.warn(
                    // watermark held back (not advanced past the failures) so
                    // the next tick retries them; surface at warn for on-call.
                    {
                        ...summary,
                        watermarkConserved: result.newWatermark === null,
                    },
                    "Affiliate ingestion job completed with errors"
                );
            } else {
                logger.info(summary, "Affiliate ingestion job completed");
            }
        },
    })
);
