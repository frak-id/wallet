import type { WithId } from "mongodb";
import type { NewsPaperContext } from "../context";
import type { NewsDocument } from "../dto/NewsDocument";
import type { FullNews, LightNews } from "../models";

/**
 * Get the news paper for the home page
 * @param ctx
 */
export async function getNewsForHome({
    newsDbRepository: repository,
}: NewsPaperContext) {
    // Get the 3 latest news
    const latestNews = await repository.getLatestNews({
        limit: 3,
        offset: 0,
    });

    // Get top 10 positive news
    const latestPositiveNews = await repository.getMostPositiveNews({
        limit: 5,
        offset: 0,
    });

    // Get the 5 most positive news
    const positiveNews = latestPositiveNews.slice(0, 5);
    const featuredNews = latestPositiveNews.slice(5, 10);

    // Get a random news
    const randomNews = await repository.getRandomNews();

    // Get a hero news
    const heroNews = await repository.getRandomNews();

    return {
        positives: positiveNews.map(newsDocumentToLightNews),
        featured: featuredNews.map(newsDocumentToLightNews),
        latest: latestNews.map(newsDocumentToLightNews),
        quickByte: newsDocumentToLightNews(randomNews),
        hero: newsDocumentToLightNews(heroNews),
    };
}

/**
 * Get a news from it's id
 * @param newsRepository
 * @param id
 */
export async function getNewsById({
    context: { newsDbRepository: repository },
    id,
}: {
    context: NewsPaperContext;
    id: string;
}): Promise<FullNews | null> {
    const document = await repository.getNewsById(id);
    if (!document) return null;

    return {
        id: document._id,
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

// Simple mapper for news document to light one
function newsDocumentToLightNews(doc: WithId<NewsDocument>): LightNews {
    if (!doc) {
        return {
            id: "t",
            title: "t",
            summary: "t",
            image: "t",
            sourceCountry: "t",
            author: "t",
            publishDate: new Date(),
        };
    }
    return {
        id: doc._id,
        title: doc.title,
        summary: doc.summary,
        image: doc.image,
        sourceCountry: doc.sourceCountry,
        author: doc.author,
        publishDate: doc.publishDate,
    };
}
