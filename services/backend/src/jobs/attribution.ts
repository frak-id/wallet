import { AttributionContext } from "../domain/attribution";
import { MutexCron } from "../utils/mutexCron";
import { CronRegistry } from "./registry";

CronRegistry.register(
    new MutexCron({
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
