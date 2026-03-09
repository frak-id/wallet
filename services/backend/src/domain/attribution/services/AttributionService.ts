import type { IdentityNode } from "../../../orchestration/identity";
import type {
    CreateTouchpointParams,
    Touchpoint,
    TouchpointRepository,
} from "../repositories/TouchpointRepository";
import type { TouchpointSource, TouchpointSourceData } from "../schemas/index";
import type { ReferralService } from "./ReferralService";

type RecordTouchpointParams = {
    identityGroupId: string;
    merchantId: string;
    source: TouchpointSource;
    sourceData: TouchpointSourceData;
    landingUrl?: string;
    lookbackDays?: number;
    referrerIdentityGroupId?: string;
};

type AttributionResult = {
    attributed: boolean;
    source: TouchpointSource | null;
    touchpointId: string | null;
    referrerIdentity?: IdentityNode;
};

export class AttributionService {
    constructor(
        private readonly touchpointRepository: TouchpointRepository,
        private readonly referralService: ReferralService
    ) {}

    async recordTouchpoint(
        params: RecordTouchpointParams
    ): Promise<{ touchpoint: Touchpoint; referralRegistered: boolean }> {
        const createParams: CreateTouchpointParams = {
            identityGroupId: params.identityGroupId,
            merchantId: params.merchantId,
            source: params.source,
            sourceData: params.sourceData,
            landingUrl: params.landingUrl,
            lookbackDays: params.lookbackDays,
        };

        const touchpoint = await this.touchpointRepository.create(createParams);

        let referralRegistered = false;
        if (
            params.source === "referral_link" &&
            params.referrerIdentityGroupId
        ) {
            const result = await this.referralService.registerReferral({
                merchantId: params.merchantId,
                referrerIdentityGroupId: params.referrerIdentityGroupId,
                refereeIdentityGroupId: params.identityGroupId,
            });
            referralRegistered = result.registered;
        }

        return { touchpoint, referralRegistered };
    }

    async attributeConversion(params: {
        identityGroupId: string;
        merchantId: string;
    }): Promise<AttributionResult> {
        const referralTouchpoint =
            await this.touchpointRepository.findLatestReferralTouchpoint({
                identityGroupId: params.identityGroupId,
                merchantId: params.merchantId,
            });

        if (
            referralTouchpoint &&
            referralTouchpoint.sourceData.type === "referral_link"
        ) {
            return {
                attributed: true,
                source: "referral_link",
                touchpointId: referralTouchpoint.id,
                referrerIdentity:
                    this.getReferrerIdentityForTouchpoint(referralTouchpoint),
            };
        }

        const touchpoints =
            await this.touchpointRepository.findValidForAttribution({
                identityGroupId: params.identityGroupId,
                merchantId: params.merchantId,
            });

        if (touchpoints.length > 0) {
            const latestTouchpoint = touchpoints[0];
            return {
                attributed: true,
                source: latestTouchpoint.source,
                touchpointId: latestTouchpoint.id,
            };
        }

        return {
            attributed: false,
            source: null,
            touchpointId: null,
        };
    }

    private getReferrerIdentityForTouchpoint({
        sourceData,
    }: Touchpoint): IdentityNode | undefined {
        if (sourceData.type !== "referral_link") return undefined;

        if (sourceData.v === 2) {
            return {
                type: "anonymous_fingerprint",
                value: sourceData.referrerClientId,
                merchantId: sourceData.referrerMerchantId,
            };
        }

        return {
            type: "wallet",
            value: sourceData.referrerWallet,
        };
    }

    async cleanupExpiredTouchpoints(): Promise<number> {
        return this.touchpointRepository.deleteExpired();
    }
}
