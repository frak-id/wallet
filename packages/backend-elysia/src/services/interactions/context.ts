import type { Elysia } from "elysia";
import { blockchainContext } from "../../common/context";
import { ProductSignerRepository } from "./repositories/ProductSignerRepository";

/**
 * Context for the interactions service
 * @param app
 */
export function interactionsContext(app: Elysia) {
    const productSignerRepository = new ProductSignerRepository();

    return app.use(blockchainContext).decorate({
        productSignerRepository,
    });
}

export type InteractionsContextApp = ReturnType<typeof interactionsContext>;
