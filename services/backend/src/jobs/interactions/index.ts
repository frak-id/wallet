import Elysia from "elysia";
import { executeInteractionJob } from "./execute";
import { purchaseTrackerJob } from "./purchaseTracker";
import { simulateInteractionJob } from "./simulate";

export const interactionsJobs = new Elysia({ name: "Jobs.interactions" })
    .use(executeInteractionJob)
    .use(simulateInteractionJob)
    .use(purchaseTrackerJob);
