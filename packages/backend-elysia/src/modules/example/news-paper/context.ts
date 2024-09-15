import { getMongoDb } from "../../../common/mongo";
import { NewsRepository } from "./repository/NewsRepository";

/**
 * Build the context for the news paper example modules
 */
export async function getNewsPaperContext() {
    // Get the db repositories
    const db = await getMongoDb({
        urlKey: "MONGODB_EXAMPLE_URI",
        db: "example",
    });
    const newsDbRepository = new NewsRepository(db);

    return {
        newsDbRepository,
    };
}

export type NewsPaperContext = Awaited<ReturnType<typeof getNewsPaperContext>>;
