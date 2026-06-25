import { AffiliateBrandRepository } from "./repositories/AffiliateBrandRepository";

const affiliateBrandRepository = new AffiliateBrandRepository();

export namespace AffiliateContext {
    export const repositories = {
        affiliateBrand: affiliateBrandRepository,
    };
}
