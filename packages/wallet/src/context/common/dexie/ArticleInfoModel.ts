import type { Hex } from "viem";

/**
 * Interface representing the mapping between an article, a content, and it's link
 */
export type ArticleInfoModel = {
    id?: number;

    // Article and content related stuff
    articleId: Hex;
    contentId: Hex;

    // The info about the articles
    articleTitle: string;
    articleUrl: string;
};
