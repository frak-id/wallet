import { MerchantRepository } from "./repositories/MerchantRepository";

const merchantRepository = new MerchantRepository();

export namespace MerchantContext {
    export const repositories = {
        merchant: merchantRepository,
    };
}
