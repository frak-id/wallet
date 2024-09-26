import { Elysia } from "elysia";
import { updateMerkleRootJob } from "./jobs/updateOrale";
import { managmentRoutes } from "./routes/managment";
import { proofRoutes } from "./routes/proof";
import { shopifyWebhook } from "./routes/shopifyWebhook";

export const oracleRoutes = new Elysia({ prefix: "/oracle" })
    .use(managmentRoutes)
    .use(shopifyWebhook)
    .use(updateMerkleRootJob)
    .use(proofRoutes)
    .get(
        "/status",
        async ({
            store: {
                cron: { updateMerkleRoot },
            },
            merkleRepository,
        }) => ({
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
            merkleeCache: {
                size: merkleRepository.cacheSize,
                trees: merkleRepository.cachedTrees,
            },
        })
    );
