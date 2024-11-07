import { Elysia } from "elysia";
import { updateMerkleRootJob } from "./jobs/updateOrale";
import { managmentRoutes } from "./routes/managment";
import { proofRoutes } from "./routes/proof";
import { shopifyWebhook } from "./routes/webhook/shopifyWebhook";
import { wooCommerceWebhook } from "./routes/webhook/wooCommerceWebhook";

export const oracle = new Elysia({ prefix: "/oracle" })
    .use(shopifyWebhook)
    .use(wooCommerceWebhook)
    .use(managmentRoutes)
    .use(updateMerkleRootJob)
    .use(proofRoutes)
    .get(
        "/status",
        async ({ cron: { updateMerkleRoot }, merkleRepository }) => ({
            updateMerkleRootCron: {
                run: {
                    prevRun: updateMerkleRoot.previousRun(),
                    currRun: updateMerkleRoot.currentRun(),
                    planning: updateMerkleRoot.nextRuns(10),
                },
                isBusy: updateMerkleRoot.isBusy(),
                isRunning: updateMerkleRoot.isRunning(),
                isStopped: updateMerkleRoot.isStopped(),
            },
            merkleCache: {
                size: merkleRepository.cacheSize,
                trees: merkleRepository.cachedTrees,
            },
        })
    );
