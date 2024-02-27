"use server";

import type { ArticleDocument } from "@/context/article/dto/ArticleDocument";
import { getArticleRepository } from "@/context/article/repository/ArticleRepository";
import type { Article, ArticlePreparedForReading } from "@/type/Article";
import { unstable_cache } from "next/cache";
import { all } from "radash";
import type { Hex } from "viem";

/**
 * Small in memory cache for already fetched articles
 */
const preparedArticleCache = new Map<Hex, ArticlePreparedForReading>();

/**
 * Find an article by its id
 * @param id
 */
async function _getArticleReadyToRead(
    id: Hex
): Promise<ArticlePreparedForReading | null> {
    console.log("Fetching article", id);
    // Check if the article is already in the cache
    const cachedArticle = preparedArticleCache.get(id);
    if (cachedArticle) {
        return cachedArticle;
    }

    const articleRepository = await getArticleRepository();
    const articleDocument = await articleRepository.getById(id);
    if (!articleDocument) {
        return null;
    }
    const mappedArticle = mapArticleDocument(articleDocument);

    // Populate the content of the articles
    const urlToArticleContent = async (url: string) => {
        const fetching = await fetch(url);
        return await fetching.text();
    };

    // Fetch the raw content of the article
    const rawContents = await all({
        rawLockedContent: urlToArticleContent(mappedArticle.lockedContentUrl),
        rawUnlockedContent: urlToArticleContent(
            mappedArticle.unlockedContentUrl
        ),
    });

    // Build our final prepared article
    const preparedArticle: ArticlePreparedForReading = {
        ...mappedArticle,
        ...rawContents,
    };

    // Cache the prepared article
    preparedArticleCache.set(id, preparedArticle);

    // And return it
    return preparedArticle;
}

/**
 * Cached version of the article to read fetch
 */
export const getArticleReadyToRead = unstable_cache(
    _getArticleReadyToRead,
    ["get-article-ready-to-read"],
    {
        // Keep that in server cache for 1 hour
        revalidate: 3600,
    }
);

/**
 * Get all the articles
 */
async function _getAllArticles() {
    const isLocal = process.env.IS_LOCAL === "true";

    const articleRepository = await getArticleRepository();
    const allDocuments = await articleRepository.getAll();

    // Filter the articles documents to get the one matching our current env
    const filteredDocuments = allDocuments.filter((document) => {
        return isLocal
            ? document.title.includes("[DEV]")
            : !document.title.includes("[DEV]");
    });

    return filteredDocuments.map(mapArticleDocument);
}

/**
 * Cached version of the articles fetch
 */
export const getAllArticles = unstable_cache(
    _getAllArticles,
    ["get-all-articles"],
    {
        // Keep that in server cache for 1 hour
        revalidate: 3600,
    }
);

function mapArticleDocument(document: ArticleDocument): Article {
    return {
        id: document._id,
        contentId: document.contentId,
        provider: document.provider,
        title: document.title,
        description: document.description,
        link: document.link,
        imageUrl: document.imageUrl,
        lockedContentUrl: document.lockedContentUrl,
        unlockedContentUrl: document.unlockedContentUrl,
    };
}
