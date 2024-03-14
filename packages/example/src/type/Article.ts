export type Article = Readonly<{
    id: string;
    contentId: string;
    provider: "le-monde" | "wired" | "l-equipe";
    title: string;
    description?: string;
    link: string;
    imageUrl: string;
    lockedContentUrl: string;
    unlockedContentUrl: string;
}>;

export type ArticlePreparedForReading = Article &
    Readonly<{
        // Raw content in text format
        rawLockedContent: string;
        rawUnlockedContent: string;
    }>;
