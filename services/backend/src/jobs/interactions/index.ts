import Elysia from "elysia";
import { interactionsContext } from "../../domain/interactions";
import { executeInteractionJob } from "./execute";
import { purchaseTrackerJob } from "./purchaseTracker";
import { simulateInteractionJob } from "./simulate";

export const interactionsJobs = new Elysia({ name: "Jobs.interactions" })
    .use(interactionsContext)
    .use(executeInteractionJob)
    .use(simulateInteractionJob)
    .use(purchaseTrackerJob);
