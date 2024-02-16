import type { Hex } from "viem";

export type ArticleDocument = Readonly<{
    // The id of the article (an hex string representing a byte32 hash)
    _id: Hex;
    // The content id linked to this article
    contentId: Hex;
    // The title of the article
    title: string;
    // The description of the article
    description?: string;
    // The link to access this article
    link: string;
    // The main image of this article
    imageUrl: string;
}>;
