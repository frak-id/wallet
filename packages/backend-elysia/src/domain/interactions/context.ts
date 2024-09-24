import { Elysia } from "elysia";
import { blockchainContext, cacheContext } from "../../common/context";
import { ProductSignerRepository } from "./repositories/ProductSignerRepository";

/**
 * Context for the interactions service
 * @param app
 */
export const interactionsContext = new Elysia({ name: "interactions-context" })
    .use(cacheContext)
    .use(blockchainContext)
    .decorate(({ cache }) => ({
        productSignerRepository: new ProductSignerRepository(cache),
    }))
    .as("plugin");

export type InteractionsContextApp = typeof interactionsContext;
