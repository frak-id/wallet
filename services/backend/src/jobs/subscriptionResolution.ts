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

            const { resolved, retry, unresolved } = outcome.result;
            if (resolved + retry + unresolved > 0) {
                logger.info(
                    { resolved, retry, unresolved },
                    "Subscription resolution job completed"
                );
            }
        },
    })
);
