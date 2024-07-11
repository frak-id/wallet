"use server";

import { getNewsRepository } from "@/context/articles/repository/NewsRepository";
import { getWorldNewsApiRepository } from "@/context/articles/repository/WorldNewsApiRepository";

/**
 * Synchronise the global news
 */
export async function synchroniseNews() {
    const newsRepository = await getNewsRepository();

    // Get the latest published date, it's yesterday or sooner exit
    const latestNewsDate = await newsRepository.getLatestNewsDate();
    console.log("Synchronising the news", { latestNewsDate });
    if (latestNewsDate) {
        const maxSyncDate = new Date();
        maxSyncDate.setHours(0, 0, 0, 0);
        maxSyncDate.setDate(maxSyncDate.getDate() - 1);
        if (latestNewsDate >= maxSyncDate) {
            return;
        }
    }

    // Fetch the latest news
    const latestNews = await getWorldNewsApiRepository().getYesterdayArticles();

    // Map them into news document
    const documents = latestNews.map((news) => ({
        title: news.title,
        text: news.text,
        summary: news.summary,
        author: news.author,
        url: news.url,
        image: news.image,
        publishDate: new Date(news.publish_date),
        category: news.catgory?.toLowerCase(),
        sourceCountry: news.source_country.toUpperCase(),
    }));

    // Create the news
    await newsRepository.createMany(documents);
}
