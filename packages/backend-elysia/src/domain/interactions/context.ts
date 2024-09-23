import type { Elysia } from "elysia";
import { blockchainContext, cacheContext } from "../../common/context";
import { ProductSignerRepository } from "./repositories/ProductSignerRepository";

/**
 * Context for the interactions service
 * @param app
 */
export function interactionsContext(app: Elysia) {
    return app
        .use(cacheContext)
        .use(blockchainContext)
        .decorate(({ cache }) => ({
            productSignerRepository: new ProductSignerRepository(cache),
        }));
}

export type InteractionsContextApp = ReturnType<typeof interactionsContext>;
