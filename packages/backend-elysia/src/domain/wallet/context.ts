import { blockchainContext, indexerApiContext } from "@backend-common";
import { Elysia } from "elysia";
import { BalancesRepository } from "./repositories/BalancesRepository";
import { PricingRepository } from "./repositories/PricingRepository";

/**
 * Context for the wallet service
 */
export const walletContext = new Elysia({
    name: "Context.wallet",
})
    .use(indexerApiContext)
    .use(blockchainContext)
    .decorate(({ client, ...decorators }) => ({
        ...decorators,
        client,
        pricingRepository: new PricingRepository(),
        balancesRepository: new BalancesRepository(client),
    }));
