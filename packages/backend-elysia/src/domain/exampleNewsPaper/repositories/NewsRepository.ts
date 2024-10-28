import { getMongoDb } from "@backend-common";
import { Mutex } from "async-mutex";
import type { Collection, WithId } from "mongodb";
import type { NewsDocument } from "../models/dto/NewsDocument";

/**
 * Repository used to access the news repositories
 */
export class NewsRepository {
    private initMutex = new Mutex();
    private collection: Collection<NewsDocument> | undefined;

    /**
     * Get the collection
     */
    private async getCollection() {
        if (this.collection) {
            return this.collection;
        }

        return this.initMutex.runExclusive(async () => {
            const db = await getMongoDb({
                urlKey: "MONGODB_EXAMPLE_URI",
                db: "example",
            });
            const collection = db.collection<NewsDocument>("news");
            this.collection = collection;
            return collection;
        });
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
        const collection = await this.getCollection();
        return collection
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
        const collection = await this.getCollection();
        return collection
            .find()
            .sort({ sentiment: -1 })
            .skip(offset)
            .limit(limit)
            .toArray();
    }

    /**
     * Get a random news
     */
    public async getRandomNews({ count }: { count: number }) {
        const collection = await this.getCollection();
        return await collection
            .aggregate<WithId<NewsDocument>>([{ $sample: { size: count } }])
            .toArray();
    }

    /**
     * Get news by its id
     * @param id
     */
    public async getNewsById(id: string) {
        const collection = await this.getCollection();
        return collection.findOne({ _id: id });
    }

    /**
     * Insert many documents
     * @param documents
     */
    public async insertMany(documents: NewsDocument[]) {
        const collection = await this.getCollection();
        return collection.insertMany(documents);
    }
}
