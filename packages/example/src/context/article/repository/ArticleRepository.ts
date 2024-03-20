import type { ArticleDocument } from "@/context/article/dto/ArticleDocument";
import { contentId } from "@/context/common/config";
import { DI } from "@/context/common/di";
import { getMongoDb } from "@/context/common/mongoDb";
import type { Collection } from "mongodb";
import type { Hex } from "viem";

/**
 * Repository used to access the article collection
 */
export class ArticleRepository {
    constructor(private readonly collection: Collection<ArticleDocument>) {}

    /**
     * Get an article by its id
     * @param id
     */
    public async getById(id: Hex): Promise<ArticleDocument | null> {
        return this.collection.findOne({ _id: id });
    }
    /**
     * Get all the articles
     */
    public async getAll(): Promise<ArticleDocument[]> {
        return this.collection.find({ contentId }).toArray();
    }

    /**
     * Create a new article
     */
    public async create(article: ArticleDocument) {
        const insertResult = await this.collection.insertOne(article);
        if (!insertResult.acknowledged) {
            throw new Error("Failed to insert test content");
        }
        return insertResult.insertedId;
    }
}

export const getArticleRepository = DI.registerAndExposeGetter({
    id: "ArticleRepository",
    isAsync: true,
    getter: async () => {
        const db = await getMongoDb();
        return new ArticleRepository(
            db.collection<ArticleDocument>("articles")
        );
    },
});
