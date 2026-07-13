import { BusinessAuthContext } from "../domain/business-auth";
import { MutexCron } from "../utils/mutexCron";
import { CronRegistry } from "./registry";

/**
 * Purge expired business-auth rows — revoked/expired DB sessions and stale
 * email OTP challenges (§2.11 / A5). Both are already ignored at read time
 * (expiry is checked on resolve), so this is pure housekeeping to keep the
 * tables from growing unbounded. Mirrors the identity domain's
 * `cleanupExpiredEmailVerificationCodes` precedent.
 */
CronRegistry.register(
    new MutexCron({
        name: "cleanupExpiredBusinessAuthRows",
        pattern: "0 0-23/6 * * *",
        run: async ({ context: { logger } }) => {
            logger.debug("Cleaning up expired business-auth rows");

            await Promise.all([
                BusinessAuthContext.repositories.session.deleteExpired(),
                BusinessAuthContext.repositories.emailCode.deleteExpired(),
            ]);

            logger.info("Expired business-auth rows cleanup completed");
        },
    })
);
