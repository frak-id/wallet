import type { Hex } from "viem";

export type ArticleDocument = Readonly<{
    // The id of the article (an hex string representing a byte32 hash)
    _id: Hex;
    // The content id linked to this article
    contentId: Hex;
    // The initial provider of this article
    provider: "le-monde" | "wired" | "l-equipe";
    // The title and description of the article
    title: string;
    description?: string;
    // The link to access this article
    link: string;
    // The main image of this article
    imageUrl: string;
    // The content url for locked and unlock
    lockedContentUrl: string;
    unlockedContentUrl: string;
}>;
