import { mutexCron } from "@backend-utils";
import { Elysia } from "elysia";
import { AttributionService } from "../domain/attribution";

export const attributionJobs = new Elysia({ name: "Job.attribution" }).use(
    mutexCron({
        name: "cleanupExpiredTouchpoints",
        pattern: "0 3 * * *",
        run: async ({ context: { logger } }) => {
            logger.debug("Cleaning up expired touchpoints");

            const attributionService = new AttributionService();
            const deletedCount =
                await attributionService.cleanupExpiredTouchpoints();

            logger.info(`Deleted ${deletedCount} expired touchpoints`);
        },
    })
);
