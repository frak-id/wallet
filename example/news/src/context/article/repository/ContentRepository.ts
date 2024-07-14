import type { ContentDocument } from "@/context/article/dto/ContentDocument";
import { getMongoDb } from "@/context/common/mongoDb";
import { DI } from "@frak-labs/shared/context/utils/di";
import type { Collection } from "mongodb";
import type { Hex } from "viem";

/**
 * Repository used to access the content collection
 */
export class ContentRepository {
    constructor(private readonly collection: Collection<ContentDocument>) {}

    /**
     * Get a content by its id
     * @param id
     */
    public async getById(id: Hex) {
        const content = await this.collection.findOne({ _id: id });
        if (!content) {
            throw new Error(`Content ${id} not found`);
        }
        return content;
    }
}

export const getContentRepository = DI.registerAndExposeGetter({
    id: "ContentRepository",
    isAsync: true,
    getter: async () => {
        const db = await getMongoDb();
        return new ContentRepository(
            db.collection<ContentDocument>("contents")
        );
    },
});
