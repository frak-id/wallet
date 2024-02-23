export type Article = Readonly<{
    id: string;
    contentId: string;
    provider: "le-monde" | "wired";
    title: string;
    description?: string;
    link: string;
    imageUrl: string;
    lockedContentUrl: string;
    unlockedContentUrl: string;
}>;
