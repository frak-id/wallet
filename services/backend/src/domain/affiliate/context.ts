import { AffiliateAttributionRepository } from "./repositories/AffiliateAttributionRepository";
import { AffiliateBrandRepository } from "./repositories/AffiliateBrandRepository";
import { AffiliateLinkService } from "./services/AffiliateLinkService";

const affiliateBrandRepository = new AffiliateBrandRepository();
const affiliateAttributionRepository = new AffiliateAttributionRepository();

const affiliateLinkService = new AffiliateLinkService(
    affiliateBrandRepository,
    affiliateAttributionRepository
);

export namespace AffiliateContext {
    export const repositories = {
        affiliateBrand: affiliateBrandRepository,
        affiliateAttribution: affiliateAttributionRepository,
    };

    export const services = {
        affiliateLink: affiliateLinkService,
    };
}
