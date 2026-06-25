import { TakeadsMerchantRepository } from "./repositories/TakeadsMerchantRepository";

const takeadsMerchantRepository = new TakeadsMerchantRepository();

export namespace TakeadsContext {
    export const repositories = {
        takeadsMerchant: takeadsMerchantRepository,
    };
}
