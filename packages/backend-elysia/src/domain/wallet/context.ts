import { blockchainContext, indexerApiContext } from "@backend-common";
import { Elysia } from "elysia";
import { BalancesRepository } from "./repositories/BalancesRepository";
import { PendingBalanceRepository } from "./repositories/PendingBalanceRepository";

/**
 * Context for the wallet service
 */
export const walletContext = new Elysia({
    name: "Context.wallet",
})
    .use(indexerApiContext)
    .use(blockchainContext)
    .decorate(({ client, indexerApi, ...decorators }) => ({
        ...decorators,
        client,
        indexerApi,
        balancesRepository: new BalancesRepository(client, indexerApi),
        pendingBalanceRepository: new PendingBalanceRepository(
            client,
            indexerApi
        ),
    }));
