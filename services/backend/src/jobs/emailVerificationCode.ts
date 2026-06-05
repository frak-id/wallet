import { IdentityContext } from "../domain/identity/context";
import { MutexCron } from "../utils/mutexCron";
import { CronRegistry } from "./registry";

CronRegistry.register(
    new MutexCron({
        name: "cleanupExpiredEmailVerificationCodes",
        pattern: "0 0-23/6 * * *",
        run: async ({ context: { logger } }) => {
            logger.debug("Cleaning up expired email verification codes");

            await IdentityContext.repositories.emailVerification.deleteExpired();

            logger.info("Expired email verification codes cleanup completed");
        },
    })
);
