import Elysia from "elysia";
import { updateMerkleRootJob } from "./jobs/updateOrale";
import { managmentRoutes } from "./routes/managment";
import { shopifyWebhook } from "./routes/shopifyWebhook";

export const oracleRoutes = new Elysia({ prefix: "oracle" })
    .use(managmentRoutes)
    .use(shopifyWebhook)
    .use(updateMerkleRootJob)
    .get(
        "/status",
        async ({
            store: {
                cron: { updateMerkleRoot },
            },
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
        })
    );
