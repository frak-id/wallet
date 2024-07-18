import { parallel } from "radash";
import { getPocMongoDb } from "../db/mongoDb";
import { getLlmFormatterRepository } from "./repository/LlmFormatterRepository";
import { getWorldNewsApiRepository } from "./repository/WorldNewsApiRepository";

/**
 * Handler that will be used to fetch news, review the text via Mistral LLM, and save them inside the mongo
 */
export async function handler() {
    // Fetch the latest news
    console.log("Fetching latest news");
    const latestNews = await getWorldNewsApiRepository().getYesterdayArticles();
    if (!latestNews?.length) {
        return;
    }
    console.log("Fetched mews", {
        length: latestNews.length,
        ids: latestNews.map((news) => news.id),
    });

    // For each news, format the text
    const llmFormatter = getLlmFormatterRepository();
    const newsWithTextReview = await parallel(2, latestNews, async (news) => {
        const llmText = await llmFormatter.formatNews({
            title: news.title,
            text: news.text,
            summary: news.summary,
        });
        console.log("Formatted news", {
            title: news.title,
            id: news.id,
        });

        return {
            ...news,
            originalText: news.text,
            text: llmText,
        };
    });

    // Map them into the right format for our database
    const documents = newsWithTextReview.map((news) => ({
        title: news.title,
        text: news.text,
        originalText: news.originalText,
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
    const db = await getPocMongoDb();
    const insertResult = await db.collection("news").insertMany(documents);
    console.log("Inserted news", {
        amount: insertResult.insertedCount,
        ids: insertResult.insertedIds,
    });
}
