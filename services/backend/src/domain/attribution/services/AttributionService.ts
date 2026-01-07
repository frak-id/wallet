import type { Address } from "viem";
import type { TouchpointSourceData } from "../db/schema";
import {
    TouchpointRepository,
    type CreateTouchpointParams,
    type Touchpoint,
} from "../repositories/TouchpointRepository";

export type TouchpointSource =
    | "referral_link"
    | "organic"
    | "paid_ad"
    | "direct";

export type RecordTouchpointParams = {
    identityGroupId: string;
    merchantId: string;
    source: TouchpointSource;
    sourceData: TouchpointSourceData;
    landingUrl?: string;
    lookbackDays?: number;
};

export type AttributionResult = {
    attributed: boolean;
    source: TouchpointSource | null;
    touchpointId: string | null;
    referrerWallet: Address | null;
};

export class AttributionService {
    private readonly touchpointRepository: TouchpointRepository;

    constructor(touchpointRepository?: TouchpointRepository) {
        this.touchpointRepository =
            touchpointRepository ?? new TouchpointRepository();
    }

    async recordTouchpoint(
        params: RecordTouchpointParams
    ): Promise<Touchpoint> {
        const createParams: CreateTouchpointParams = {
            identityGroupId: params.identityGroupId,
            merchantId: params.merchantId,
            source: params.source,
            sourceData: params.sourceData,
            landingUrl: params.landingUrl,
            lookbackDays: params.lookbackDays,
        };

        return this.touchpointRepository.create(createParams);
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

        if (referralTouchpoint) {
            return {
                attributed: true,
                source: "referral_link",
                touchpointId: referralTouchpoint.id,
                referrerWallet: referralTouchpoint.referrerWallet,
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
                referrerWallet: null,
            };
        }

        return {
            attributed: false,
            source: null,
            touchpointId: null,
            referrerWallet: null,
        };
    }

    async cleanupExpiredTouchpoints(): Promise<number> {
        return this.touchpointRepository.deleteExpired();
    }
}
