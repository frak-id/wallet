import { InstagramContext } from "../domain/instagram/context";
import { tryWithAdvisoryLock } from "../infrastructure/persistence/postgres";
import { MutexCron } from "../utils/mutexCron";
import { CronRegistry } from "./registry";

/** One renewal at a time: two replicas renewing at once would each store a different token. */
const INSTAGRAM_TOKEN_ADVISORY_LOCK_KEY = 0x1a57a0;

CronRegistry.register(
    new MutexCron({
        name: "instagramToken",
        pattern: "17 4 * * *",
        run: async ({ context: { logger } }) => {
            const outcome = await tryWithAdvisoryLock(
                INSTAGRAM_TOKEN_ADVISORY_LOCK_KEY,
                () => InstagramContext.services.instagramToken.refreshIfDue(),
                "instagramToken"
            );
            if (outcome.ran && outcome.result !== "fresh") {
                logger.info(
                    { outcome: outcome.result },
                    "Instagram token renewal"
                );
            }
        },
    })
);
