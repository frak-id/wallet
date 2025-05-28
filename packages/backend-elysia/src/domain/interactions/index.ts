import { Elysia } from "elysia";
import { executeInteractionJob } from "./jobs/execute";
import { purchaseTrackerJob } from "./jobs/purchaseTracker";
import { simulateInteractionJob } from "./jobs/simulate";
import { webhookRoutes } from "./routes/webhook";

export const interactions = new Elysia({
    prefix: "/interactions",
})
    .use(executeInteractionJob)
    .use(simulateInteractionJob)
    .use(webhookRoutes)
    .use(purchaseTrackerJob);

export { interactionsContext } from "./context";
export {
    backendTrackerTable,
    pendingInteractionsTable,
    interactionsPurchaseTrackerTable,
} from "./db/schema";
export { InteractionRequestDto } from "./dto/InteractionDto";
