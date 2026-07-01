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

/**
 * Consecutive-run stall counter (R4). A single errored, non-advancing run is
 * expected occasionally (a transient failure, a retried poison action); only
 * escalate to `error` once the cursor looks *stuck* across several runs in a
 * row. Process-local by design — it resets on restart, same tradeoff as the
 * per-action retry budget in the orchestrator.
 */
let consecutiveStalledRuns = 0;
const STALL_ESCALATION_THRESHOLD = 3;

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
            const stalled = result.errors > 0 && result.newWatermark === null;
            consecutiveStalledRuns = stalled ? consecutiveStalledRuns + 1 : 0;

            if (result.errors > 0) {
                if (consecutiveStalledRuns >= STALL_ESCALATION_THRESHOLD) {
                    logger.error(
                        {
                            ...result,
                            watermarkAdvanced: result.newWatermark !== null,
                            consecutiveStalledRuns,
                        },
                        "Affiliate ingestion cursor appears stuck, manual attention needed"
                    );
                } else {
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
                }
            } else {
                logger.info(result, "Affiliate ingestion job completed");
            }
        },
    })
);
