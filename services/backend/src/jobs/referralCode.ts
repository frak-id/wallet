import { ReferralCodeContext } from "../domain/referral-code/context";
import { MutexCron } from "../utils/mutexCron";
import { CronRegistry } from "./registry";

/**
 * Daily cleanup of referral codes whose revocation predates the grace
 * window. After deletion, the 6-char string becomes available for a fresh
 * owner to claim.
 */
CronRegistry.register(
    new MutexCron({
        name: "cleanupExpiredRevokedReferralCodes",
        pattern: "0 3 * * *",
        run: async ({ context: { logger } }) => {
            logger.debug("Cleaning up expired revoked referral codes");

            const deletedCount =
                await ReferralCodeContext.repositories.referralCode.deleteExpiredRevoked();

            logger.info(
                { deletedCount },
                "Expired revoked referral codes cleanup completed"
            );
        },
    })
);
