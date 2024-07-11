export type LightNews = {
    id: string;
    title: string;
    summary: string;
    image: string;
    sourceCountry: string;
    author: string;
    publishDate: Date;
    category?: string;
};

export type FullNews = LightNews & {
    text: string;
    url: string;
};
