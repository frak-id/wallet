import { OrchestrationContext } from "../orchestration/context";
import { MutexCron } from "../utils/mutexCron";
import { CronRegistry } from "./registry";

/** Monerium has no webhooks on the OAuth plan: orders, profiles and wallet links are polled. */
CronRegistry.register(
    new MutexCron({
        name: "moneriumSync",
        pattern: "*/2 * * * *",
        run: async ({ context: { logger } }) => {
            const summary =
                await OrchestrationContext.orchestrators.moneriumSync.syncTick();
            logger.debug(summary, "Monerium sync tick completed");
        },
    })
);
