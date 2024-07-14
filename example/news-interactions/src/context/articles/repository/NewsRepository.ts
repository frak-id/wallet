import type { NewsDocument } from "@/context/articles/dto/NewsDocument";
import { getMongoDb } from "@/context/common/mongoDb";
import { DI } from "@frak-labs/shared/context/utils/di";
import type { Collection, ObjectId, WithId } from "mongodb";

/**
 * Repository used to access the news repository
 */
class NewsRepository {
    constructor(private readonly collection: Collection<NewsDocument>) {}

    /**
     * Get the latest news date
     */
    public async getLatestNewsDate() {
        const latestNews = await this.collection
            .find()
            .sort({ publishDate: -1 })
            .limit(1)
            .toArray();
        return latestNews.length > 0 ? latestNews[0].publishDate : null;
    }

    /**
     * Get the latest news
     * @param limit
     * @param offset
     */
    public async getLatestNews({
        limit,
        offset,
    }: { limit: number; offset: number }) {
        return this.collection
            .find()
            .sort({ publishDate: -1 })
            .skip(offset)
            .limit(limit)
            .toArray();
    }

    /**
     * Get the latest news
     * @param limit
     * @param offset
     */
    public async getMostPositiveNews({
        limit,
        offset,
    }: { limit: number; offset: number }) {
        return this.collection
            .find()
            .sort({ sentiment: -1 })
            .skip(offset)
            .limit(limit)
            .toArray();
    }

    /**
     * Get a random news
     */
    public async getRandomNews() {
        const documents = await this.collection
            .aggregate<WithId<NewsDocument>>([{ $sample: { size: 1 } }])
            .toArray();
        return documents[0];
    }

    /**
     * Get a news by it's id
     * @param id
     */
    public async getNewsById(id: ObjectId) {
        return this.collection.findOne({ _id: id });
    }

    /**
     * Create multiple news
     */
    public async createMany(news: NewsDocument[]) {
        const insertResult = await this.collection.insertMany(news);
        if (!insertResult.acknowledged) {
            throw new Error("Failed to insert the news");
        }
    }
}

export const getNewsRepository = DI.registerAndExposeGetter({
    id: "NewsRepository",
    isAsync: true,
    getter: async () => {
        const db = await getMongoDb();
        return new NewsRepository(db.collection<NewsDocument>("news"));
    },
});
