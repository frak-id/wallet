import { OrchestrationContext } from "../orchestration/context";
import { MutexCron } from "../utils/mutexCron";
import { CronRegistry } from "./registry";

/**
 * Deliver scheduled merchant broadcasts once they fall due.
 * Runs every minute — the smallest schedulable granularity; the claim query is
 * indexed on `scheduled_at` and the table is low-volume, so the tick is cheap.
 */
CronRegistry.register(
    new MutexCron({
        name: "sendScheduledNotifications",
        pattern: "* * * * *",
        run: async () => {
            await OrchestrationContext.orchestrators.notification.processDueScheduledNotifications();
        },
    })
);
