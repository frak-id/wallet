import { Elysia } from "elysia";
import { BalancesRepository } from "./repositories/BalancesRepository";
import { PendingBalanceRepository } from "./repositories/PendingBalanceRepository";

/**
 * Context for the wallet service
 */
export const walletContext = new Elysia({
    name: "Context.wallet",
})
    .decorate({
        wallet: {
            repositories: {
                balances: new BalancesRepository(),
                pendingBalance: new PendingBalanceRepository(),
            },
        },
    })
    .as("scoped");
