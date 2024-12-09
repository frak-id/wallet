export class WorldNewsApiRepository {
    constructor(private apiKey: string) {}

    /**
     * Get the articles from yesterday
     */
    public async getYesterdayArticles() {
        // Get the date 6 hours ago (can be negative)
        const sixHoursAgo = new Date();
        sixHoursAgo.setHours(sixHoursAgo.getHours() - 6);

        // Get the date 6 hours ago (can be negative)
        const eighteenHoursAgo = new Date();
        eighteenHoursAgo.setHours(eighteenHoursAgo.getHours() - 24);

        // Build the url we will query
        const url = new URL("https://api.worldnewsapi.com/search-news");
        url.searchParams.append("api-key", this.apiKey);
        url.searchParams.append("source-countries", "us,eu");
        url.searchParams.append("language", "en");
        url.searchParams.append(
            "categories",
            "sports,technology,science,environment,health"
        );
        url.searchParams.append("min-sentiment", "-0.2");
        url.searchParams.append("max-sentiment", "0.9");
        url.searchParams.append(
            "earliest-publish-date",
            this.formatDate(eighteenHoursAgo)
        );
        url.searchParams.append(
            "latest-publish-date",
            this.formatDate(sixHoursAgo)
        );
        url.searchParams.append("sort", "publish-time");
        url.searchParams.append("sort-direction", "DESC");
        url.searchParams.append("number", "20");

        // Query it
        const response = await fetch(url.toString());
        const data = (await response.json()) as NewsResponse;

        // And return our data, filter out all the news without an image
        return data.news.filter((news) => news.image);
    }

    // Format the date in the form:  yyyy-mm-dd hh:mm:ss
    formatDate(date: Date) {
        return date.toISOString().split(".")[0].replace("T", " ");
    }
}

type NewsResponse = {
    offset: number;
    number: number;
    available: number;
    news: {
        id: number;
        title: string;
        text: string;
        summary?: string;
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
