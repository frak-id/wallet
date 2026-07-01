import { HttpError } from "@backend-utils";
import { type AffiliateProvider, PROVIDER_SUBID_PARAM } from "../provider";
import type { AffiliateAttributionRepository } from "../repositories/AffiliateAttributionRepository";
import type { AffiliateBrandRepository } from "../repositories/AffiliateBrandRepository";
import { generateAffiliateToken } from "../token";

// Single affiliate provider for now. When a second network is added, thread the
// provider through from the caller instead of hardcoding it here.
const PROVIDER: AffiliateProvider = "takeads";

export type AffiliateShareLink = {
    provider: AffiliateProvider;
    token: string;
    url: string;
};

/**
 * Owns affiliate brand linking + user-specific share-link minting.
 *
 * Brand-level sharing needs **no provider API call**: the per-user link is the
 * brand's stored `trackingLink` with the provider's sub-id query-param set to
 * our attribution token. The `/resolve` flow (deep/product URLs) is deferred.
 *
 * The token is minted server-side and bound to the caller's `identityGroupId`
 * — the frontend can never choose its own token.
 */
export class AffiliateLinkService {
    constructor(
        private readonly affiliateBrandRepository: AffiliateBrandRepository,
        private readonly affiliateAttributionRepository: AffiliateAttributionRepository
    ) {}

    /**
     * Link an internal merchant to its provider brand (platform-admin
     * registration). Validates the tracking link and refuses to steal a brand
     * already linked to a different merchant.
     */
    async registerBrand(params: {
        merchantId: string;
        externalId: string;
        trackingLink: string;
    }): Promise<void> {
        assertHttpsUrl(params.trackingLink);

        const existing =
            await this.affiliateBrandRepository.findByProviderAndExternalId(
                PROVIDER,
                params.externalId
            );
        if (existing && existing.merchantId !== params.merchantId) {
            throw HttpError.conflict(
                "AFFILIATE_BRAND_TAKEN",
                `Affiliate brand ${params.externalId} is already linked to another merchant`
            );
        }

        await this.affiliateBrandRepository.link({
            merchantId: params.merchantId,
            provider: PROVIDER,
            externalId: params.externalId,
            trackingLink: params.trackingLink,
        });
    }

    /**
     * Read the caller's existing share link for a merchant **without minting**
     * one. Returns null when the user has not created a link yet (drives the
     * lazy "create then share" two-step flow in the explorer). Still throws if
     * the merchant isn't an affiliate brand at all.
     */
    async getShareLink(params: {
        merchantId: string;
        identityGroupId: string;
    }): Promise<AffiliateShareLink | null> {
        const brand = await this.requireBrand(params.merchantId);

        const attribution =
            await this.affiliateAttributionRepository.findByUserAndBrand({
                provider: PROVIDER,
                identityGroupId: params.identityGroupId,
                merchantId: params.merchantId,
            });
        if (!attribution) return null;

        return this.buildShareLink(brand.trackingLink, attribution.token);
    }

    async getOrCreateShareLink(params: {
        merchantId: string;
        identityGroupId: string;
    }): Promise<AffiliateShareLink> {
        const brand = await this.requireBrand(params.merchantId);

        const attribution = await this.affiliateAttributionRepository.mint({
            token: generateAffiliateToken(),
            provider: PROVIDER,
            identityGroupId: params.identityGroupId,
            merchantId: params.merchantId,
            trackingLink: brand.trackingLink,
        });

        return this.buildShareLink(brand.trackingLink, attribution.token);
    }

    private async requireBrand(merchantId: string) {
        const brand =
            await this.affiliateBrandRepository.findByMerchantAndProvider(
                merchantId,
                PROVIDER
            );
        if (!brand) {
            throw HttpError.notFound(
                "AFFILIATE_BRAND_NOT_FOUND",
                "Merchant is not linked to this affiliate provider"
            );
        }
        return brand;
    }

    /**
     * Build the per-user share link: the brand tracking link with the
     * provider's sub-id query-param set to our attribution token. trackingLink
     * is validated as a well-formed https URL at link time, so this never
     * throws; setting the sub-id param overwrites any stale one.
     */
    private buildShareLink(
        trackingLink: string,
        token: string
    ): AffiliateShareLink {
        const url = new URL(trackingLink);
        url.searchParams.set(PROVIDER_SUBID_PARAM[PROVIDER], token);
        return {
            provider: PROVIDER,
            token,
            url: url.toString(),
        };
    }
}

/** Reject anything that isn't a well-formed https URL before we persist it. */
function assertHttpsUrl(value: string): void {
    let parsed: URL;
    try {
        parsed = new URL(value);
    } catch {
        throw HttpError.badRequest(
            "INVALID_TRACKING_LINK",
            "trackingLink must be a valid URL"
        );
    }
    if (parsed.protocol !== "https:") {
        throw HttpError.badRequest(
            "INVALID_TRACKING_LINK",
            "trackingLink must use https"
        );
    }
}
