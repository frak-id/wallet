import type { Address } from "viem";
import { isAddress } from "viem";
import type { TouchpointSourceData } from "../../../domain/attribution";
import type { AttributionService } from "../../../domain/attribution/services/AttributionService";
import { IdentityContext } from "../../../domain/identity";
import type {
    InteractionType,
    ReferralArrivalPayload,
} from "../../../domain/rewards/types";
import type { HandlerContext, InteractionHandler } from "../types";

export type ArrivalInput = {
    merchantId: string;
    referrerWallet?: string;
    referrerClientId?: string;
    referrerMerchantId?: string;
    landingUrl?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmTerm?: string;
    utmContent?: string;
};

export type ArrivalExtra = {
    touchpointId: string;
    referrerWallet?: Address;
};

export class ArrivalHandler
    implements
        InteractionHandler<ArrivalInput, ReferralArrivalPayload, ArrivalExtra>
{
    constructor(private readonly attributionService: AttributionService) {}

    getInteractionType(_input: ArrivalInput): InteractionType {
        return "referral";
    }

    buildExternalEventId(
        _input: ArrivalInput,
        payload: ReferralArrivalPayload,
        _context: HandlerContext
    ): string {
        return `referral:${payload.touchpointId ?? Date.now()}`;
    }

    async buildPayload(
        input: ArrivalInput,
        context: HandlerContext
    ): Promise<ReferralArrivalPayload> {
        const sourceData = this.buildSourceData(input);
        const referrerIdentityGroupId =
            await this.resolveReferrerGroupId(input);

        const { touchpoint, referralRegistered } =
            await this.attributionService.recordTouchpoint({
                identityGroupId: context.identity.identityGroupId,
                merchantId: input.merchantId,
                source: sourceData.type,
                sourceData,
                landingUrl: input.landingUrl,
                referrerIdentityGroupId,
            });

        return {
            referrerWallet: input.referrerWallet as Address,
            landingUrl: input.landingUrl,
            touchpointId: touchpoint.id,
            referralRegistered,
        };
    }

    async postProcess(
        _input: ArrivalInput,
        _context: HandlerContext,
        payload: ReferralArrivalPayload
    ): Promise<ArrivalExtra> {
        return {
            touchpointId: payload?.touchpointId ?? "",
            referrerWallet: payload?.referrerWallet,
        };
    }

    shouldCreateInteractionLog(
        input: ArrivalInput,
        payload: ReferralArrivalPayload
    ): boolean {
        return (
            this.isReferralSource(input) && payload.referralRegistered === true
        );
    }

    private isReferralSource(input: ArrivalInput): boolean {
        if (input.referrerClientId && input.referrerMerchantId) {
            return true;
        }
        return Boolean(input.referrerWallet && isAddress(input.referrerWallet));
    }

    private buildSourceData(input: ArrivalInput): TouchpointSourceData {
        if (input.referrerClientId && input.referrerMerchantId) {
            return {
                type: "referral_link",
                referrerClientId: input.referrerClientId,
                referrerMerchantId: input.referrerMerchantId,
            };
        }

        if (input.referrerWallet && isAddress(input.referrerWallet)) {
            return {
                type: "referral_link",
                referrerWallet: input.referrerWallet as Address,
            };
        }

        if (input.utmSource || input.utmMedium || input.utmCampaign) {
            return {
                type: "paid_ad",
                utmSource: input.utmSource,
                utmMedium: input.utmMedium,
                utmCampaign: input.utmCampaign,
                utmTerm: input.utmTerm,
                utmContent: input.utmContent,
            };
        }

        return { type: "direct" };
    }

    private async resolveReferrerGroupId(
        input: ArrivalInput
    ): Promise<string | undefined> {
        if (input.referrerClientId && input.referrerMerchantId) {
            const group =
                await IdentityContext.repositories.identity.findGroupByIdentity(
                    {
                        type: "anonymous_fingerprint",
                        value: input.referrerClientId,
                        merchantId: input.referrerMerchantId,
                    }
                );
            return group?.id ?? undefined;
        }

        if (!input.referrerWallet || !isAddress(input.referrerWallet)) {
            return undefined;
        }
        const group =
            await IdentityContext.repositories.identity.findGroupByIdentity({
                type: "wallet",
                value: input.referrerWallet,
            });
        return group?.id ?? undefined;
    }
}
