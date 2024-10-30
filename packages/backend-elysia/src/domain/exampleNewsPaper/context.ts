import { mongoDbContext } from "@backend-common";
import { Elysia } from "elysia";
import { NewsRepository } from "./repositories/NewsRepository";
/**
 * Elysia plugin with the news paper context
 */
export const newsPaperContext = new Elysia({
    name: "Context.newsPaper",
})
    .use(mongoDbContext)
    .decorate(({ getMongoDb, ...decorators }) => ({
        ...decorators,
        newsDbRepository: new NewsRepository(getMongoDb),
    }));

export type NewsPaperContextApp = typeof newsPaperContext;
