"use server";

import type { NewsDocument } from "@/context/articles/dto/NewsDocument";
import { getLlmFormatterRepository } from "@/context/articles/repository/LlmFormatterRepository";
import { getNewsRepository } from "@/context/articles/repository/NewsRepository";
import { getWorldNewsApiRepository } from "@/context/articles/repository/WorldNewsApiRepository";
import { parallel } from "radash";

/**
 * Synchronise the global news
 */
export async function synchroniseNews() {
    const newsRepository = await getNewsRepository();

    // Get the latest published date, it's yesterday or sooner exit
    const latestNewsDate = await newsRepository.getLatestNewsDate();
    if (latestNewsDate) {
        const maxSyncDate = new Date();
        maxSyncDate.setHours(maxSyncDate.getHours() - 24);
        if (latestNewsDate > maxSyncDate) {
            return;
        }
    }

    // Fetch the latest news
    const latestNews = await getWorldNewsApiRepository().getYesterdayArticles();
    if (!latestNews?.length) {
        return;
    }

    // For each news, format the text
    const llmFormatter = getLlmFormatterRepository();
    const newsWithFormattedText = await parallel(
        2,
        latestNews,
        async (news) => {
            const llmText = await llmFormatter.formatNews({
                title: news.title,
                text: news.text,
                summary: news.summary,
            });

            return {
                ...news,
                originalText: news.text,
                text: llmText,
            };
        }
    );

    // Map them into news document
    const documents: NewsDocument[] = newsWithFormattedText.map((news) => ({
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

    // Create the news
    await newsRepository.createMany(documents);
}
