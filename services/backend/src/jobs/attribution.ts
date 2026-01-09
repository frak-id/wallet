import { mutexCron } from "@backend-utils";
import { Elysia } from "elysia";
import { AttributionContext } from "../domain/attribution";

export const attributionJobs = new Elysia({ name: "Job.attribution" }).use(
    mutexCron({
        name: "cleanupExpiredTouchpoints",
        pattern: "0 3 * * *",
        run: async ({ context: { logger } }) => {
            logger.debug("Cleaning up expired touchpoints");

            const deletedCount =
                await AttributionContext.services.attribution.cleanupExpiredTouchpoints();

            logger.info(`Deleted ${deletedCount} expired touchpoints`);
        },
    })
);
