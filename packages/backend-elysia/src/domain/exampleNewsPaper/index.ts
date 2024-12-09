import { isRunningInProd } from "@frak-labs/app-essentials";
import { Elysia } from "elysia";
import { newsPaperContext } from "./context";
import { fetchLatestNewsJob } from "./jobs/fetchLatestNews";
import { newsRoutes } from "./routes/news";

/**
 * Example newspaper service
 * If running on prod, remove the service (Tree shaking will do the rest to completely remove the service code from the build, thx terser)
 */
export const exampleNewsPaper = isRunningInProd
    ? new Elysia({ name: "EmptyElysia" })
    : new Elysia({ prefix: "/exampleNewsPaper" })
          .use(newsPaperContext)
          // Our jobs
          .use(fetchLatestNewsJob)
          // Our routes
          .use(newsRoutes)
          // Status endpoint
          .get("/status", async ({ cron: { fetchNews } }) => ({
              fetchNewsCron: {
                  run: {
                      prevRun: fetchNews.previousRun(),
                      currRun: fetchNews.currentRun(),
                      planning: fetchNews.nextRuns(10),
                  },
                  isBusy: fetchNews.isBusy(),
                  isRunning: fetchNews.isRunning(),
                  isStopped: fetchNews.isStopped(),
              },
          }));
