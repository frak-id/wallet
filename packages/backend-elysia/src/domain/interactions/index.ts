import { Elysia } from "elysia";
import { executeInteractionJob } from "./jobs/execute";
import { purchaseTrackerJob } from "./jobs/purchaseTracker";
import { simulateInteractionJob } from "./jobs/simulate";
import { purchaseInteractionsRoutes } from "./routes/purchase";
import { pushInteractionsRoutes } from "./routes/push";
import { rewardsRoutes } from "./routes/rewards";
import { webhookRoutes } from "./routes/webhook";

export const interactions = new Elysia({
    prefix: "/interactions",
})
    .use(executeInteractionJob)
    .use(simulateInteractionJob)
    .use(rewardsRoutes)
    .use(webhookRoutes)
    .use(pushInteractionsRoutes)
    .use(purchaseInteractionsRoutes)
    .use(purchaseTrackerJob);

export { interactionsContext } from "./context";
export { backendTrackerTable } from "./db/schema";
