import { getMongoDb } from "@backend-common/mongo";
import type { Elysia } from "elysia";
import { NewsRepository } from "./repositories/NewsRepository";

/**
 * Elysia plugin with the news paper context
 */
export async function newsPaperContext(app: Elysia) {
    // Get the db repositories
    const db = await getMongoDb({
        urlKey: "MONGODB_EXAMPLE_URI",
        db: "example",
    });
    const newsDbRepository = new NewsRepository(db);

    // Decorate the app
    return app.decorate({
        newsDbRepository,
    });
}

export type NewsPaperContextApp = Awaited<ReturnType<typeof newsPaperContext>>;
