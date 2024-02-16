"use server";

import type { ArticleDocument } from "@/context/article/dto/ArticleDocument";
import { getArticleRepository } from "@/context/article/repository/ArticleRepository";
import type { Article } from "@/type/Article";
import type { Hex } from "viem";

/**
 * Find an article by its id
 * @param id
 */
export async function getArticle(id: Hex): Promise<Article | null> {
    const articleRepository = await getArticleRepository();
    const articleDocument = await articleRepository.getById(id);
    if (!articleDocument) {
        return null;
    }
    return mapArticleDocument(articleDocument);
}

/**
 * Get all the articles
 */
export async function getAllArticles() {
    const articleRepository = await getArticleRepository();
    const allDocuments = await articleRepository.getAll();
    return allDocuments.map(mapArticleDocument);
}

function mapArticleDocument(document: ArticleDocument): Article {
    return {
        id: document._id,
        contentId: document.contentId,
        title: document.title,
        description: document.description,
        link: document.link,
        imageUrl: document.imageUrl,
    };
}
