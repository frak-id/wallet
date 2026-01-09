import { mutexCron } from "@backend-utils";
import { Elysia } from "elysia";
import { OrchestrationContext } from "../orchestration";

export const settlementJobs = new Elysia({ name: "Job.settlement" }).use(
    mutexCron({
        name: "settleRewards",
        pattern: "0 * * * *",
        run: async ({ context: { logger } }) => {
            logger.debug("Starting reward settlement batch");

            const result =
                await OrchestrationContext.orchestrators.settlement.runSettlement();

            logger.info(
                {
                    pushed: result.pushedCount,
                    locked: result.lockedCount,
                    failed: result.failedCount,
                    txCount: result.txHashes.length,
                    errorCount: result.errors.length,
                },
                "Settlement job completed"
            );

            if (result.errors.length > 0) {
                logger.warn(
                    {
                        errors: result.errors.slice(0, 10),
                        totalErrors: result.errors.length,
                    },
                    "Settlement job had errors"
                );
            }
        },
    })
);
