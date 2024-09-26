import { Elysia } from "elysia";
import { executeInteractionJob } from "./jobs/execute";
import { simulateInteractionJob } from "./jobs/simulate";
import { purchaseInteractionsRoutes } from "./routes/purchase";
import { pushInteractionsRoutes } from "./routes/push";

export const interactionRoutes = new Elysia({
    prefix: "/interactions",
})
    .use(executeInteractionJob)
    .use(simulateInteractionJob)
    .use(pushInteractionsRoutes)
    .use(purchaseInteractionsRoutes)
    .get(
        "/status",
        ({
            store: {
                cron: { simulateInteraction, executeInteraction },
            },
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
        })
    );
