import { BalancesRepository } from "./repositories/BalancesRepository";
import { PendingBalanceRepository } from "./repositories/PendingBalanceRepository";

/**
 * Context for the wallet service
 */
export namespace WalletContext {
    export const repositories = {
        balances: new BalancesRepository(),
        pendingBalance: new PendingBalanceRepository(),
    };
}
