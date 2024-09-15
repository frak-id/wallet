import cron, { Patterns } from "@elysiajs/cron";
import type { Elysia } from "elysia";
import { t } from "elysia";
import { getNewsPaperContext } from "./context";
import { fetchLatestNew, getNewsById, getNewsForHome } from "./controller";
import { FullNewsDto, LightNewsDto } from "./models";

/**
 * Elysia group for the example-news-paper website
 * @param app
 */
export const exampleNewsPaper = async (app: Elysia) => {
    // Get our context
    const context = await getNewsPaperContext();

    // Then build our api
    return app.group("/exampleNewsPaper", (app) =>
        app
            .decorate(context)
            // Cron to automatically fetch the latest news every 6 hours
            .use(
                cron({
                    name: "fetchNews",
                    pattern: Patterns.everyHours(6),
                    run: () => fetchLatestNew(context),
                })
            )
            // Get the latest news for the gome page
            .get("/news/home", async (context) => getNewsForHome(context), {
                response: t.Object({
                    positives: t.Array(LightNewsDto),
                    featured: t.Array(LightNewsDto),
                    latest: t.Array(LightNewsDto),
                    quickByte: LightNewsDto,
                    hero: LightNewsDto,
                }),
            })
            // Get news from its id
            .get(
                "/news/:id",
                async ({ params: { id }, ...context }) =>
                    getNewsById({ context, id }),
                {
                    params: t.Object({
                        id: t.String(),
                    }),
                    response: t.Union([FullNewsDto, t.Null()]),
                }
            )
            // Endpoint to fetch the status of the news example website
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
            )
    );
};
