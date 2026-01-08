import type { Address } from "viem";
import { ReferralService } from "../../referral";
import type { TouchpointSourceData } from "../db/schema";
import {
    type CreateTouchpointParams,
    type Touchpoint,
    TouchpointRepository,
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
    referrerIdentityGroupId?: string;
};

export type AttributionResult = {
    attributed: boolean;
    source: TouchpointSource | null;
    touchpointId: string | null;
    referrerWallet: Address | null;
};

export class AttributionService {
    private readonly touchpointRepository: TouchpointRepository;
    private readonly referralService: ReferralService;

    constructor(
        touchpointRepository?: TouchpointRepository,
        referralService?: ReferralService
    ) {
        this.touchpointRepository =
            touchpointRepository ?? new TouchpointRepository();
        this.referralService = referralService ?? new ReferralService();
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

        const touchpoint = await this.touchpointRepository.create(createParams);

        if (
            params.source === "referral_link" &&
            params.referrerIdentityGroupId
        ) {
            await this.referralService.registerReferral({
                merchantId: params.merchantId,
                referrerIdentityGroupId: params.referrerIdentityGroupId,
                refereeIdentityGroupId: params.identityGroupId,
            });
        }

        return touchpoint;
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
