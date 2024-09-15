import { cluster, all } from "radash";
import { Config } from "sst/node/config";
import type { NewsPaperContext } from "../context";
import { LlmFormatterRepository } from "../repository/LlmFormatterRepository";
import { WorldNewsApiRepository } from "../repository/WorldNewsApiRepository";

/**
 * Fetch the latest news
 * @param context
 */
export async function fetchLatestNew({ newsDbRepository }: NewsPaperContext) {
    console.log("Fetching latest news");

    // Build the repository we will use
    const worldNewsApiRepository = new WorldNewsApiRepository(
        Config.WORLD_NEWS_API_KEY
    );
    const llmRepository = new LlmFormatterRepository();

    // Fetch the latest news
    const latestNews = await worldNewsApiRepository.getYesterdayArticles();
    if (!latestNews?.length) {
        return;
    }
    console.log("Fetched news", {
        length: latestNews.length,
        ids: latestNews.map((news) => news.id),
    });

    // We will make cluster of 2 news, to process in //
    const clusters = cluster(latestNews, 2);

    // Process each cluster
    for (const cluster of clusters) {
        console.log("Processing news cluster", {
            length: cluster.length,
            ids: cluster.map((news) => news.id),
        });
        // For each news, format the text
        const formattedNews = await all(
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
        console.log("Inserted news", {
            amount: insertResult.insertedCount,
            ids: insertResult.insertedIds,
        });
    }
}
