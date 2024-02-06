export type Article = Readonly<{
    id: string;
    contentId: string;
    title: string;
    description?: string;
    link: string;
}>;
