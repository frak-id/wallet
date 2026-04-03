import { IdentityContext } from "../domain/identity/context";
import { MutexCron } from "../utils/mutexCron";
import { CronRegistry } from "./registry";

CronRegistry.register(
    new MutexCron({
        name: "cleanupExpiredInstallCodes",
        pattern: "0 0-23/6 * * *",
        run: async ({ context: { logger } }) => {
            logger.debug("Cleaning up expired install codes");

            const result =
                await IdentityContext.repositories.installCode.deleteExpired();

            logger.info(
                { deletedCount: result },
                "Expired install codes cleanup completed"
            );
        },
    })
);
