import type { NewsDocument } from "@/context/articles/dto/NewsDocument";
import { getMongoDb } from "@/context/common/mongoDb";
import type { Collection, ObjectId, WithId } from "mongodb";
import { memo } from "radash";

/**
 * Repository used to access the news repository
 */
class NewsRepository {
    constructor(private readonly collection: Collection<NewsDocument>) {}

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
}

export const getNewsRepository = memo(
    async () => {
        const db = await getMongoDb();
        return new NewsRepository(db.collection<NewsDocument>("news"));
    },
    { key: () => "NewsRepository" }
);
