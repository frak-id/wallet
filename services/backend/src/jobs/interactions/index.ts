import { Elysia } from "elysia";
import { executeInteractionJob } from "./execute";
import { purchaseTrackerJob } from "./purchaseTracker";
import { retryInteractionJob } from "./retry";
import { simulateInteractionJob } from "./simulate";

export const interactionsJobs = new Elysia({ name: "Jobs.interactions" })
    .use(executeInteractionJob)
    .use(simulateInteractionJob)
    .use(purchaseTrackerJob)
    .use(retryInteractionJob);
