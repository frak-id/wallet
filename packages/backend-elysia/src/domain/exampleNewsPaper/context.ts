import { Elysia } from "elysia";
import { NewsRepository } from "./repositories/NewsRepository";
/**
 * Elysia plugin with the news paper context
 */
export const newsPaperContext = new Elysia({
    name: "Context.newsPaper",
}).decorate({
    newsDbRepository: new NewsRepository(),
});

export type NewsPaperContextApp = typeof newsPaperContext;
