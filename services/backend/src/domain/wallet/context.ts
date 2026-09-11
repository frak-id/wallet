import { BalancesRepository } from "./repositories/BalancesRepository";

export namespace WalletContext {
    export const repositories = {
        balances: new BalancesRepository(),
    };
}
