import type { Collection, Db, WithId } from "mongodb";
import type { NewsDocument } from "../models/dto/NewsDocument";

/**
 * Repository used to access the news repository
 */
export class NewsRepository {
    private readonly collection: Collection<NewsDocument>;
    constructor(db: Db) {
        this.collection = db.collection<NewsDocument>("news");
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
     * Get news by its id
     * @param id
     */
    public async getNewsById(id: string) {
        return this.collection.findOne({ _id: id });
    }

    /**
     * Insert many documents
     * @param documents
     */
    public async insertMany(documents: NewsDocument[]) {
        return this.collection.insertMany(documents);
    }
}
