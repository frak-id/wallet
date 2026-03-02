import { BalancesRepository } from "./repositories/BalancesRepository";

/**
 * Context for the wallet service
 */
export namespace WalletContext {
    export const repositories = {
        balances: new BalancesRepository(),
    };
}
