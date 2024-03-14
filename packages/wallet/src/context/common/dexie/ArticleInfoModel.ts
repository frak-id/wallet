import type { Hex } from "viem";

export type ArticleProvider = {
    slug: "le-monde" | "wired" | "l-equipe";
    name: string;
    imageUrl: string;
};

/**
 * Interface representing the mapping between an article, a content, and it's link
 */
export type ArticleInfoModel = {
    // Article and content related stuff
    articleId: Hex;
    contentId: Hex;

    // Some info about the content
    contentTitle: string;

    // The info about the articles
    articleTitle: string;
    articleUrl: string;

    // The info about the provider
    provider?: ArticleProvider;
};
