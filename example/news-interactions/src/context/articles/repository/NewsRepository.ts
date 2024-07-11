import type { NewsDocument } from "@/context/articles/dto/NewsDocument";
import { getMongoDb } from "@/context/common/mongoDb";
import { DI } from "@frak-labs/shared/context/utils/di";
import type { Collection } from "mongodb";

/**
 * Repository used to access the news repository
 */
class NewsRepository {
    constructor(private readonly collection: Collection<NewsDocument>) {}

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
    id: "ArticleRepository",
    isAsync: true,
    getter: async () => {
        const db = await getMongoDb();
        return new NewsRepository(db.collection<NewsDocument>("news"));
    },
});
