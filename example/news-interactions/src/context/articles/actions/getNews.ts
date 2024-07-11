"use server";

import { synchroniseNews } from "@/context/articles/actions/newsSyncer";
import { getNewsRepository } from "@/context/articles/repository/NewsRepository";
import type { FullNews, LightNews } from "@/types/News";
import { ObjectId } from "mongodb";

/**
 * Get the latest news
 * @param limit
 * @param offset
 */
export async function getLatestNews({
    limit,
    offset,
}: { limit: number; offset: number }): Promise<LightNews[]> {
    // Do a synchronisation if needed
    await synchroniseNews();

    // Get the repository and fetch the news
    const repository = await getNewsRepository();
    const documents = await repository.getLatestNews({ limit, offset });
    return documents.map((doc) => ({
        id: doc._id.toHexString(),
        title: doc.title,
        summary: doc.summary,
        image: doc.image,
        sourceCountry: doc.sourceCountry,
        author: doc.author,
        publishDate: doc.publishDate,
    }));
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
