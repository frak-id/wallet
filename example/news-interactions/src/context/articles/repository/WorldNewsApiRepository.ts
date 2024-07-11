import { DI } from "@frak-labs/shared/context/utils/di";

class WorldNewsApiRepository {
    constructor(private apiKey: string) {}

    /**
     * Get the articles from yesterday
     */
    public async getYesterdayArticles() {
        // Get the dte for yesterday
        const yesterday = new Date();
        yesterday.setHours(0, 0, 0, 0);
        yesterday.setDate(yesterday.getDate() - 1);

        // Get the dte for yesterday
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        // Build the url we will query
        const url = new URL("https://api.worldnewsapi.com/search-news");
        url.searchParams.append("api-key", this.apiKey);
        url.searchParams.append("source-countries", "us,eu");
        url.searchParams.append("language", "en");
        url.searchParams.append("min-sentiment", "0.1");
        url.searchParams.append("max-sentiment", "1");
        url.searchParams.append(
            "earliest-publish-date",
            yesterday.toISOString()
        );
        url.searchParams.append(
            "latest-publish-date",
            todayStart.toISOString()
        );

        // Query it
        const response = await fetch(url.toString());
        const data = (await response.json()) as NewsResponse;

        // And return our data
        return data.news;
    }
}

export const getWorldNewsApiRepository = DI.registerAndExposeGetter({
    id: "WorldNewsApiRepository",
    getter: () => {
        const apiKey = process.env.WORLD_NEWS_API_KEY;
        if (!apiKey) {
            throw new Error("Missing WORLD_NEWS_API_KEY");
        }

        return new WorldNewsApiRepository(apiKey);
    },
});

type NewsResponse = {
    offset: number;
    number: number;
    available: number;
    news: {
        id: number;
        title: string;
        text: string;
        summary: string;
        url: string;
        image: string;
        video?: string;
        publish_date: string;
        author: string;
        authors: string[];
        language: string;
        source_country: string;
        sentiment: number;
        catgory?: string;
    }[];
};
