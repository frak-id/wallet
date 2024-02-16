"use server";

import { randomBytes } from "node:crypto";
import { onlyAdmin } from "@/context/admin/action/authenticate";
import { getArticleRepository } from "@/context/article/repository/ArticleRepository";
import { getContentRepository } from "@/context/article/repository/ContentRepository";
import { keccak256 } from "viem";
import type { Hex } from "viem";

const contentId: Hex = "0xDD";

/**
 * Setup simple test data for the article
 */
export async function createArticle({
    title,
    description,
    origin,
}: {
    title: string;
    description?: string;
    origin: string;
}) {
    // Lock this function to admin only
    await onlyAdmin();
    // Insert the test content
    const contentRepository = await getContentRepository();
    const content = await contentRepository.getById(contentId);

    // Generate a random article id
    const articleId = keccak256(randomBytes(64));

    // Insert a test article for this content
    const articleRepository = await getArticleRepository();
    await articleRepository.create({
        _id: articleId,
        contentId: content._id,
        title: title,
        description: description || `This is a test content for ${title}`,
        link: `${origin}/article?id=${articleId}`,
        imageUrl: `https://picsum.photos/seed/${articleId}/500`,
    });

    // And return the article id
    return articleId;
}
