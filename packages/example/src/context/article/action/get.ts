"use server";

import type { ArticleDocument } from "@/context/article/dto/ArticleDocument";
import { getArticleRepository } from "@/context/article/repository/ArticleRepository";
import type { Article, ArticlePreparedForReading } from "@/type/Article";
import { all } from "radash";
import type { Hex } from "viem";

/**
 * Find an article by its id
 * @param id
 */
export async function getArticleReadyToRead(
    id: Hex
): Promise<ArticlePreparedForReading | null> {
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

    return {
        ...mappedArticle,
        ...rawContents,
    };
}

/**
 * Get all the articles
 */
export async function getAllArticles() {
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
