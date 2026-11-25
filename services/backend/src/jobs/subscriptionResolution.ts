import { tryWithAdvisoryLock } from "../infrastructure/persistence/postgres";
import { OrchestrationContext } from "../orchestration";
import { MutexCron } from "../utils/mutexCron";
import { SUBSCRIPTION_RESOLUTION_ADVISORY_LOCK_KEY } from "./locks";
import { CronRegistry } from "./registry";

const BATCH_SIZE = 50;

CronRegistry.register(
    new MutexCron({
        name: "subscriptionResolution",
        pattern: "* * * * *",
        run: async ({ context: { logger } }) => {
            const outcome = await tryWithAdvisoryLock(
                SUBSCRIPTION_RESOLUTION_ADVISORY_LOCK_KEY,
                () =>
                    OrchestrationContext.orchestrators.subscriptionResolution.resolveDue(
                        { limit: BATCH_SIZE }
                    ),
                "subscription-resolution"
            );
            if (!outcome.ran) return;

            const counts = outcome.result;
            if (Object.values(counts).some((count) => count > 0)) {
                logger.info(counts, "Subscription resolution job completed");
            }
        },
    })
);
