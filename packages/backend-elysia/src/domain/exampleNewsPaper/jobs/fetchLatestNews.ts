import { mutexCron } from "@backend-utils";
import type { pino } from "@bogeychan/elysia-logger";
import { cluster } from "radash";
import type { NewsPaperContextApp } from "../context";
import { LlmFormatterRepository } from "../repositories/LlmFormatterRepository";
import type { NewsRepository } from "../repositories/NewsRepository";
import { WorldNewsApiRepository } from "../repositories/WorldNewsApiRepository";

/**
 * Cron to fetch the latest news
 *   - We are tricking a bit elysia here to access the singleton store from the cron
 */
export const fetchLatestNewsJob = (app: NewsPaperContextApp) =>
    app
        // Cron to automatically fetch the latest news every 6 hours
        .use(
            mutexCron({
                name: "fetchNews",
                skipIfLocked: true,
                pattern: "0 0-23/6 * * *", // Every 6 hours
                run: async ({ context: { logger } }) => {
                    // Get the repositories we will use
                    const worldNewsApiRepository = new WorldNewsApiRepository(
                        process.env.WORLD_NEWS_API_KEY as string
                    );
                    const llmRepository = new LlmFormatterRepository();

                    // Perform the logic
                    await fetchLatestNew({
                        newsDbRepository: app.decorator.newsDbRepository,
                        llmRepository,
                        worldNewsApiRepository,
                        logger,
                    });
                },
            })
        );

/**
 * Core function of the job
 * @param newsDbRepository
 * @param llmRepository
 * @param worldNewsApiRepository
 * @param logger
 */
async function fetchLatestNew({
    newsDbRepository,
    llmRepository,
    worldNewsApiRepository,
    logger,
}: {
    newsDbRepository: NewsRepository;
    llmRepository: LlmFormatterRepository;
    worldNewsApiRepository: WorldNewsApiRepository;
    logger: pino.Logger;
}) {
    // Fetch the latest news
    const latestNews = await worldNewsApiRepository.getYesterdayArticles();
    if (!latestNews?.length) {
        return;
    }
    logger.debug(
        {
            length: latestNews.length,
            ids: latestNews.map((news) => news.id),
        },
        "Fetched news"
    );

    // We will make cluster of 2 news, to process in //
    const clusters = cluster(latestNews, 2);

    // Process each cluster
    for (const cluster of clusters) {
        logger.debug(
            {
                length: cluster.length,
                ids: cluster.map((news) => news.id),
            },
            "Processing news cluster"
        );
        try {
            // For each news, format the text
            const formattedNews = await Promise.all(
                cluster.map(async (news) => {
                    const llmText = await llmRepository.formatNews({
                        title: news.title,
                        text: news.text,
                        summary: news.summary,
                    });
                    const summary =
                        news.summary ?? (await llmRepository.getSummary(news));

                    return {
                        ...news,
                        summary,
                        text: llmText,
                        origin: {
                            text: news.text,
                            summary: news.summary,
                        },
                    };
                })
            );

            // Map them into the right format for our database
            const documents = formattedNews.map((news) => ({
                _id: news.id.toString(),
                title: news.title,
                text: news.text,
                origin: news.origin,
                summary: news.summary,
                author: news.author,
                url: news.url,
                image: news.image,
                publishDate: new Date(news.publish_date),
                sentiment: news.sentiment,
                category: news.catgory?.toLowerCase(),
                sourceCountry: news.source_country.toUpperCase(),
            }));

            // Then insert them
            const insertResult = await newsDbRepository.insertMany(documents);
            logger.info(
                {
                    amount: insertResult.insertedCount,
                    ids: insertResult.insertedIds,
                },
                "Inserted news"
            );
        } catch (error) {
            logger.warn({ error }, "Error while processing news cluster");
        }
    }
}
