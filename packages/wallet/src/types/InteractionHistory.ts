import type { ArticleProvider } from "@/context/common/dexie/ArticleInfoModel";
import type { Address } from "viem";

type BaseInteraction = {
    contentId: string;
    timestamp: number; // timestamp in seconds
};

export type OpenOrReadInteraction = BaseInteraction & {
    type: "OPEN_ARTICLE" | "READ_ARTICLE";
    data: {
        articleId: string;
    };
};
export type ReferredInteraction = BaseInteraction & {
    type: "REFERRED";
    data: {
        referrer: Address;
    };
};

export type InteractionHistory = OpenOrReadInteraction | ReferredInteraction;

/**
 * Represent an interaction history item with the front data
 */
export type InteractionHistoryWithFrontData = InteractionHistory & {
    articleUrl?: string;
    articleTitle?: string;
    contentTitle?: string;
    provider?: ArticleProvider;
};
