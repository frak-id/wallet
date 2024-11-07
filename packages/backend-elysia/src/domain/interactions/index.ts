import { Elysia } from "elysia";
import { executeInteractionJob } from "./jobs/execute";
import { purchaseTrackerJob } from "./jobs/purchaseTracker";
import { simulateInteractionJob } from "./jobs/simulate";
import { purchaseInteractionsRoutes } from "./routes/purchase";
import { pushInteractionsRoutes } from "./routes/push";

export const interactions = new Elysia({
    prefix: "/interactions",
})
    .use(executeInteractionJob)
    .use(simulateInteractionJob)
    .use(pushInteractionsRoutes)
    .use(purchaseInteractionsRoutes)
    .use(purchaseTrackerJob)
    .get(
        "/status",
        ({
            cron: { simulateInteraction, executeInteraction, purchaseTracker },
        }) => ({
            simulateInteractionCron: {
                run: {
                    prevRun: simulateInteraction.previousRun(),
                    currRun: simulateInteraction.currentRun(),
                    planning: simulateInteraction.nextRuns(10),
                },
                isBusy: simulateInteraction.isBusy(),
                isRunning: simulateInteraction.isRunning(),
                isStopped: simulateInteraction.isStopped(),
            },
            executeInteractionCron: {
                run: {
                    prevRun: executeInteraction.previousRun(),
                    currRun: executeInteraction.currentRun(),
                    planning: executeInteraction.nextRuns(10),
                },
                isBusy: executeInteraction.isBusy(),
                isRunning: executeInteraction.isRunning(),
                isStopped: executeInteraction.isStopped(),
            },
            purchaseTrackerCron: {
                run: {
                    prevRun: purchaseTracker.previousRun(),
                    currRun: purchaseTracker.currentRun(),
                    planning: purchaseTracker.nextRuns(10),
                },
                isBusy: purchaseTracker.isBusy(),
                isRunning: purchaseTracker.isRunning(),
                isStopped: purchaseTracker.isStopped(),
            },
        })
    );
