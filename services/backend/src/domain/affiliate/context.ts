import { AffiliateAttributionRepository } from "./repositories/AffiliateAttributionRepository";
import { AffiliateBrandRepository } from "./repositories/AffiliateBrandRepository";
import { AffiliateSyncStateRepository } from "./repositories/AffiliateSyncStateRepository";
import { AffiliateLinkService } from "./services/AffiliateLinkService";

const affiliateBrandRepository = new AffiliateBrandRepository();
const affiliateAttributionRepository = new AffiliateAttributionRepository();
const affiliateSyncStateRepository = new AffiliateSyncStateRepository();

const affiliateLinkService = new AffiliateLinkService(
    affiliateBrandRepository,
    affiliateAttributionRepository
);

export namespace AffiliateContext {
    export const repositories = {
        affiliateAttribution: affiliateAttributionRepository,
        affiliateSyncState: affiliateSyncStateRepository,
    };

    export const services = {
        affiliateLink: affiliateLinkService,
    };
}
