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
        return "referral_arrival";
    }

    buildExternalEventId(
        _input: ArrivalInput,
        payload: ReferralArrivalPayload,
        _context: HandlerContext
    ): string {
        return `referral_arrival:${payload.touchpointId ?? Date.now()}`;
    }

    async buildPayload(
        input: ArrivalInput,
        context: HandlerContext
    ): Promise<ReferralArrivalPayload> {
        const sourceData = this.buildSourceData(input);
        const referrerIdentityGroupId = await this.resolveReferrerGroupId(
            input.referrerWallet
        );

        const touchpoint = await this.attributionService.recordTouchpoint({
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

    shouldCreateInteractionLog(input: ArrivalInput): boolean {
        return this.isReferralSource(input);
    }

    private isReferralSource(input: ArrivalInput): boolean {
        return Boolean(input.referrerWallet && isAddress(input.referrerWallet));
    }

    private buildSourceData(input: ArrivalInput): TouchpointSourceData {
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
        referrerWallet: string | undefined
    ): Promise<string | undefined> {
        if (!referrerWallet || !isAddress(referrerWallet)) {
            return undefined;
        }
        const group =
            await IdentityContext.repositories.identity.findGroupByIdentity({
                type: "wallet",
                value: referrerWallet,
            });
        return group?.id ?? undefined;
    }
}
