import { Elysia } from "elysia";
import { newsPaperContext } from "./context";
import { fetchLatestNewsJob } from "./jobs/fetchLatestNews";
import { newsRoutes } from "./routes/news";

/**
 * Example newspaper service
 */
export const exampleNewsPaper = new Elysia({ prefix: "/exampleNewsPaper" })
    .use(newsPaperContext)
    // Our jobs
    .use(fetchLatestNewsJob)
    // Our routes
    .use(newsRoutes)
    // Status endpoint
    .get(
        "/status",
        async ({
            store: {
                cron: { fetchNews },
            },
        }) => ({
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
        })
    );
