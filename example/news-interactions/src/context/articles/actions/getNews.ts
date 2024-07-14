"use server";

import { synchroniseNews } from "@/context/articles/actions/newsSyncer";
import type { NewsDocument } from "@/context/articles/dto/NewsDocument";
import { getNewsRepository } from "@/context/articles/repository/NewsRepository";
import type { FullNews, LightNews } from "@/types/News";
import { ObjectId, type WithId } from "mongodb";

/**
 * Get the latest news
 */
export async function getNewsForHome() {
    // Do a synchronisation if needed
    await synchroniseNews();

    // Get the repository and fetch the news
    const repository = await getNewsRepository();

    // Get the 3 latest news
    const latestNews = await repository.getLatestNews({ limit: 3, offset: 0 });

    // Get the 5 most positive news
    const positiveNews = await repository.getMostPositiveNews({
        limit: 5,
        offset: 0,
    });
    const featuredNews = await repository.getMostPositiveNews({
        limit: 5,
        offset: 5,
    });

    // Get a random news
    const randomNews = await repository.getRandomNews();

    return {
        positives: positiveNews.map(newsDocumentToLightNews),
        featured: featuredNews.map(newsDocumentToLightNews),
        latest: latestNews.map(newsDocumentToLightNews),
        quickByte: newsDocumentToLightNews(randomNews),
    };
}

function newsDocumentToLightNews(doc: WithId<NewsDocument>): LightNews {
    return {
        id: doc._id.toHexString(),
        title: doc.title,
        summary: doc.summary,
        image: doc.image,
        sourceCountry: doc.sourceCountry,
        author: doc.author,
        publishDate: doc.publishDate,
    };
}

/**
 * Get a news by it's id
 * @param id
 */
export async function getNewsById(id: string): Promise<FullNews | null> {
    const repository = await getNewsRepository();
    const document = await repository.getNewsById(
        ObjectId.createFromHexString(id)
    );
    if (!document) {
        return null;
    }

    return {
        id: document._id.toHexString(),
        title: document.title,
        summary: document.summary,
        image: document.image,
        sourceCountry: document.sourceCountry,
        author: document.author,
        publishDate: document.publishDate,
        text: document.text,
        url: document.url,
    };
}
