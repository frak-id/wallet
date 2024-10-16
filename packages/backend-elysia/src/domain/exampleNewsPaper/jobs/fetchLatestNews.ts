import { log } from "@backend-common";
import { mutexCron } from "@backend-utils";
import { Patterns } from "@elysiajs/cron";
import { cluster } from "radash";
import { Config } from "sst/node/config";
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
                pattern: Patterns.everyHours(6),
                run: async () => {
                    // Get the repositories we will use
                    const newsDbRepository = app.decorator.newsDbRepository;
                    const worldNewsApiRepository = new WorldNewsApiRepository(
                        Config.WORLD_NEWS_API_KEY
                    );
                    const llmRepository = new LlmFormatterRepository();

                    // Perform the logic
                    await fetchLatestNew({
                        newsDbRepository,
                        llmRepository,
                        worldNewsApiRepository,
                    });
                },
            })
        );

/**
 * Core function of the job
 * @param newsDbRepository
 * @param llmRepository
 * @param worldNewsApiRepository
 */
async function fetchLatestNew({
    newsDbRepository,
    llmRepository,
    worldNewsApiRepository,
}: {
    newsDbRepository: NewsRepository;
    llmRepository: LlmFormatterRepository;
    worldNewsApiRepository: WorldNewsApiRepository;
}) {
    // Fetch the latest news
    const latestNews = await worldNewsApiRepository.getYesterdayArticles();
    if (!latestNews?.length) {
        return;
    }
    log.debug(
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
        log.debug(
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
            log.info(
                {
                    amount: insertResult.insertedCount,
                    ids: insertResult.insertedIds,
                },
                "Inserted news"
            );
        } catch (error) {
            log.warn({ error }, "Error while processing news cluster");
        }
    }
}
