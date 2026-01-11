import { mutexCron } from "@backend-utils";
import { Elysia } from "elysia";
import { IdentityContext } from "../domain/identity/context";

export const identityResolutionJobs = new Elysia({
    name: "Job.identityResolution",
}).use(
    mutexCron({
        name: "resolveIdentities",
        pattern: "0 * * * *",
        triggerKeys: ["newPendingIdentityResolution"],
        coolDownInMs: 60_000,
        skipIfLocked: true,
        run: async ({ context: { logger } }) => {
            logger.debug("Starting identity resolution batch");

            const result =
                await IdentityContext.services.identityResolutionBatch.processPendingResolutions();

            logger.info(
                {
                    processed: result.processedCount,
                    success: result.successCount,
                    failed: result.failedCount,
                    txHash: result.txHash,
                },
                "Identity resolution job completed"
            );
        },
    })
);
