import { HttpError } from "@backend-utils";
import { type AffiliateProvider, PROVIDER_SUBID_PARAM } from "../provider";
import type { AffiliateAttributionRepository } from "../repositories/AffiliateAttributionRepository";
import type { AffiliateBrandRepository } from "../repositories/AffiliateBrandRepository";
import { generateAffiliateToken } from "../token";

export type AffiliateShareLink = {
    provider: AffiliateProvider;
    token: string;
    url: string;
    couponCode: string | null;
};

/**
 * Mints (or reuses) a user-specific affiliate share link for a merchant.
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

    async getOrCreateShareLink(params: {
        merchantId: string;
        identityGroupId: string;
        // v1 has a single provider; the param keeps the API stable once the
        // union grows (caller resolves which provider to share through).
        provider?: AffiliateProvider;
    }): Promise<AffiliateShareLink> {
        const provider = params.provider ?? "takeads";

        const brand =
            await this.affiliateBrandRepository.findByMerchantAndProvider(
                params.merchantId,
                provider
            );
        if (!brand) {
            throw HttpError.notFound(
                "AFFILIATE_BRAND_NOT_FOUND",
                "Merchant is not linked to this affiliate provider"
            );
        }

        const attribution = await this.affiliateAttributionRepository.mint({
            token: generateAffiliateToken(),
            provider,
            identityGroupId: params.identityGroupId,
            merchantId: params.merchantId,
            trackingLink: brand.trackingLink,
        });

        return {
            provider,
            token: attribution.token,
            url: this.buildShareUrl(
                brand.trackingLink,
                provider,
                attribution.token
            ),
            couponCode: attribution.couponCode ?? null,
        };
    }

    private buildShareUrl(
        trackingLink: string,
        provider: AffiliateProvider,
        token: string
    ): string {
        const url = new URL(trackingLink);
        url.searchParams.set(PROVIDER_SUBID_PARAM[provider], token);
        return url.toString();
    }
}
