import { mutexCron } from "@backend-utils";
import type { pino } from "@bogeychan/elysia-logger";
import type { NewsPaperContextApp } from "../context";
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

                    // Perform the logic
                    await fetchLatestNew({
                        newsDbRepository: app.decorator.newsDbRepository,
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
    worldNewsApiRepository,
    logger,
}: {
    newsDbRepository: NewsRepository;
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

    // Process each news
    try {
        // For each news, format the text
        const formattedNews = latestNews.map((news) => ({
            ...news,
            summary: news.summary ?? news.text.slice(0, 300),
            text: news.text,
        }));

        // Map them into the right format for our database
        const documents = formattedNews.map((news) => ({
            _id: news.id.toString(),
            title: news.title,
            text: news.text,
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
