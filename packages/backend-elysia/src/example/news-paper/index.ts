import cron, { Patterns } from "@elysiajs/cron";
import { Elysia } from "elysia";

/**
 * Elysia plugin for the news-paper example
 */
export const exampleNewsPaper = new Elysia().group(
    "/example/news-paper",
    (app) =>
        app
            // Add every specific singleton here (dbInstance, aws clients, etc)
            .decorate({
                dbInstance: "dbInstance",
            })
            // Cron to automatically fetch the latest news every 6 hours
            .use(
                cron({
                    name: "fetchNews",
                    pattern: Patterns.everyHours(6),
                    run() {
                        console.log("Heartbeat");
                        // todo: Previous logic of news fetching + mistral cleanup
                    },
                })
            )
            // Endpoint to get the status of the cron
            .get(
                "/cron/fetch-news",
                async ({
                    store: {
                        cron: { fetchNews },
                    },
                }) => {
                    return {
                        run: {
                            prevRun: fetchNews.previousRun(),
                            currRun: fetchNews.currentRun(),
                            nextRun: fetchNews.nextRun(),
                        },
                        isBusy: fetchNews.isBusy(),
                        isRunning: fetchNews.isRunning(),
                        isStopped: fetchNews.isStopped(),
                    };
                }
            )
            .get("/latest-news", () => {
                // todo: Logic to fetch latest news, same as the exemple in the repo
            })
);
